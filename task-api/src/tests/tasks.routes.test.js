const request = require("supertest");
const app = require("../app");
const svc = require("../services/taskService");

beforeEach(() => svc._reset());

const make = (body = {}) =>
  request(app)
    .post("/tasks")
    .send({ title: "T", ...body });

describe("POST /tasks", () => {
  test("creates a task", async () => {
    const res = await make({ priority: "high" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "T",
      priority: "high",
      status: "todo",
    });
  });

  test.each([
    [{ title: "" }],
    [{ title: 123 }],
    [{ title: "x", status: "bogus" }],
    [{ title: "x", priority: "urgent" }],
    [{ title: "x", dueDate: "not-a-date" }],
  ])("rejects invalid body %j", async (body) => {
    const res = await request(app).post("/tasks").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("rejects missing title", async () => {
    expect((await request(app).post("/tasks").send({})).status).toBe(400);
  });
});

describe("GET /tasks", () => {
  test("lists all tasks", async () => {
    await make();
    await make();
    const res = await request(app).get("/tasks");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test("filters by exact status", async () => {
    await make({ status: "todo" });
    await make({ status: "in_progress" });
    expect((await request(app).get("/tasks?status=todo")).body).toHaveLength(1);
    expect((await request(app).get("/tasks?status=in")).body).toHaveLength(0);
  });

  test("paginates (1-based)", async () => {
    for (let i = 1; i <= 15; i++) await make({ title: `t${i}` });
    const p1 = await request(app).get("/tasks?page=1&limit=10");
    const p2 = await request(app).get("/tasks?page=2&limit=10");
    expect(p1.body).toHaveLength(10);
    expect(p1.body[0].title).toBe("t1");
    expect(p2.body).toHaveLength(5);
  });

  test("uses defaults when only limit or only page is given", async () => {
    for (let i = 1; i <= 12; i++) await make();
    expect((await request(app).get("/tasks?limit=5")).body).toHaveLength(5);
    expect((await request(app).get("/tasks?page=2")).body).toHaveLength(2);
  });

  test("status and pagination combine", async () => {
    for (let i = 0; i < 3; i++) await make({ status: "done" });
    await make({ status: "todo" });
    const res = await request(app).get("/tasks?status=done&page=1&limit=2");
    expect(res.body).toHaveLength(2);
  });

  test.each([
    "page=0",
    "page=-1",
    "page=abc",
    "limit=0",
    "limit=-5",
    "limit=1.5",
  ])("rejects invalid pagination %s", async (q) => {
    expect((await request(app).get(`/tasks?${q}`)).status).toBe(400);
  });
});

describe("PUT /tasks/:id", () => {
  test("updates a task", async () => {
    const { body } = await make();
    const res = await request(app)
      .put(`/tasks/${body.id}`)
      .send({ title: "New", status: "in_progress" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "New", status: "in_progress" });
  });

  test("404 for unknown id", async () => {
    expect(
      (await request(app).put("/tasks/nope").send({ title: "x" })).status,
    ).toBe(404);
  });

  test("400 for invalid body", async () => {
    const { body } = await make();
    expect(
      (await request(app).put(`/tasks/${body.id}`).send({ title: "" })).status,
    ).toBe(400);
  });
});

describe("DELETE /tasks/:id", () => {
  test("deletes with 204, then 404", async () => {
    const { body } = await make();
    expect((await request(app).delete(`/tasks/${body.id}`)).status).toBe(204);
    expect((await request(app).delete(`/tasks/${body.id}`)).status).toBe(404);
  });
});

describe("PATCH /tasks/:id/complete", () => {
  test("completes and keeps priority", async () => {
    const { body } = await make({ priority: "high" });
    const res = await request(app).patch(`/tasks/${body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("done");
    expect(res.body.completedAt).not.toBeNull();
    expect(res.body.priority).toBe("high");
  });

  test("404 for unknown id", async () => {
    expect((await request(app).patch("/tasks/nope/complete")).status).toBe(404);
  });
});

describe("GET /tasks/stats", () => {
  test("returns counts and overdue", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    await make({ dueDate: past });
    await make({ status: "done", dueDate: past });
    const res = await request(app).get("/tasks/stats");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 0, done: 1, overdue: 1 });
  });
});

describe("PATCH /tasks/:id/assign", () => {
  test("assigns and returns the updated task", async () => {
    const { body } = await make();
    const res = await request(app)
      .patch(`/tasks/${body.id}/assign`)
      .send({ assignee: " Riyaz " });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe("Riyaz");
    expect(res.body.id).toBe(body.id);
  });

  test("allows reassignment", async () => {
    const { body } = await make();
    await request(app)
      .patch(`/tasks/${body.id}/assign`)
      .send({ assignee: "A" });
    const res = await request(app)
      .patch(`/tasks/${body.id}/assign`)
      .send({ assignee: "B" });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe("B");
  });

  test("404 for unknown id", async () => {
    expect(
      (await request(app).patch("/tasks/nope/assign").send({ assignee: "A" }))
        .status,
    ).toBe(404);
  });

  test.each([
    [{}],
    [{ assignee: "" }],
    [{ assignee: "   " }],
    [{ assignee: 42 }],
    [{ assignee: null }],
    [{ assignee: "x".repeat(101) }],
  ])("rejects invalid body %j", async (payload) => {
    const { body } = await make();
    const res = await request(app)
      .patch(`/tasks/${body.id}/assign`)
      .send(payload);
    expect(res.status).toBe(400);
  });
});

describe("validation (bug #7)", () => {
  test.each([
    [{ title: "x", status: "" }],
    [{ title: "x", status: null }],
    [{ title: "x", priority: "" }],
    [{ title: "x", priority: null }],
    [{ title: "x", description: 123 }],
    [{ title: "x", dueDate: 123 }],
    [{ title: "x", dueDate: "" }],
  ])("POST rejects %j", async (payload) => {
    expect((await request(app).post("/tasks").send(payload)).status).toBe(400);
  });

  test("POST accepts dueDate null", async () => {
    expect((await make({ dueDate: null })).status).toBe(201);
  });

  test("rejects a non-object body", async () => {
    const res = await request(app).post("/tasks").send([1, 2]);
    expect(res.status).toBe(400);
  });

  test.each([[{ status: "" }], [{ description: 123 }], [{ dueDate: 123 }]])(
    "PUT rejects %j",
    async (payload) => {
      const { body } = await make();
      expect(
        (await request(app).put(`/tasks/${body.id}`).send(payload)).status,
      ).toBe(400);
    },
  );
});

describe("PUT protected fields (bug #5)", () => {
  test("ignores id, createdAt, completedAt and unknown fields", async () => {
    const { body } = await make();
    const res = await request(app).put(`/tasks/${body.id}`).send({
      id: "hacked",
      createdAt: "2000-01-01T00:00:00.000Z",
      completedAt: "2000-01-01T00:00:00.000Z",
      hack: true,
      title: "New",
    });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(body.id);
    expect(res.body.createdAt).toBe(body.createdAt);
    expect(res.body.completedAt).toBeNull();
    expect(res.body.hack).toBeUndefined();
    expect(res.body.title).toBe("New");
  });

  test("status done via PUT sets completedAt", async () => {
    const { body } = await make();
    const res = await request(app)
      .put(`/tasks/${body.id}`)
      .send({ status: "done" });
    expect(res.body.completedAt).not.toBeNull();
  });
});

describe("complete is idempotent (bug #6)", () => {
  test("second call returns 200 and the same task", async () => {
    const { body } = await make();
    const a = await request(app).patch(`/tasks/${body.id}/complete`);
    const b = await request(app).patch(`/tasks/${body.id}/complete`);
    expect(b.status).toBe(200);
    expect(b.body.completedAt).toBe(a.body.completedAt);
  });
});

describe("app-level error handling", () => {
  test("malformed JSON returns 400, not 500", async () => {
    const res = await request(app)
      .post("/tasks")
      .set("Content-Type", "application/json")
      .send('{"title": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid JSON body");
  });

  test("unknown route returns JSON 404", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Route not found");
  });
});
