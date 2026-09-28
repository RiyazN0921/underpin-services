const svc = require("../services/taskService");

beforeEach(() => svc._reset());
afterEach(() => jest.useRealTimers());

describe("create / getAll / findById", () => {
  test("applies defaults", () => {
    const t = svc.create({ title: "A" });
    expect(t).toMatchObject({
      title: "A",
      description: "",
      status: "todo",
      priority: "medium",
      dueDate: null,
      assignee: null,
      completedAt: null,
    });
    expect(t.id).toBeDefined();
    expect(svc.findById(t.id)).toEqual(t);
  });

  test("creating directly as done sets completedAt", () => {
    expect(
      svc.create({ title: "a", status: "done" }).completedAt,
    ).not.toBeNull();
  });

  test("getAll returns a copy, not the internal array", () => {
    svc.create({ title: "A" });
    svc.getAll().push({ fake: true });
    expect(svc.getAll()).toHaveLength(1);
  });

  test("findById returns undefined for unknown id", () => {
    expect(svc.findById("nope")).toBeUndefined();
  });
});

describe("getByStatus", () => {
  test("exact match only (no substring matching)", () => {
    svc.create({ title: "a", status: "todo" });
    svc.create({ title: "b", status: "in_progress" });
    expect(svc.getByStatus("todo")).toHaveLength(1);
    expect(svc.getByStatus("in")).toHaveLength(0);
    expect(svc.getByStatus("in_progress")).toHaveLength(1);
  });
});

describe("getPaginated", () => {
  beforeEach(() => {
    for (let i = 1; i <= 15; i++) svc.create({ title: `t${i}` });
  });

  test("page 1 starts at the first item", () => {
    const r = svc.getPaginated(1, 10);
    expect(r).toHaveLength(10);
    expect(r[0].title).toBe("t1");
  });

  test("page 2 returns the remainder", () => {
    const r = svc.getPaginated(2, 10);
    expect(r).toHaveLength(5);
    expect(r[0].title).toBe("t11");
  });

  test("page beyond range returns empty", () => {
    expect(svc.getPaginated(5, 10)).toEqual([]);
  });

  test("combines with status filter", () => {
    svc.create({ title: "x", status: "done" });
    expect(svc.getPaginated(1, 10, "done")).toHaveLength(1);
  });
});

describe("getStats", () => {
  test("counts by status and overdue", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    svc.create({ title: "a", dueDate: past });
    svc.create({ title: "b", status: "in_progress", dueDate: future });
    svc.create({ title: "c", status: "done", dueDate: past });
    expect(svc.getStats()).toEqual({
      todo: 1,
      in_progress: 1,
      done: 1,
      overdue: 1,
    });
  });
});

describe("update / remove", () => {
  test("update merges fields", () => {
    const t = svc.create({ title: "a" });
    expect(svc.update(t.id, { title: "b" }).title).toBe("b");
  });

  test("update returns null for unknown id", () => {
    expect(svc.update("nope", { title: "x" })).toBeNull();
  });

  test("remove deletes and reports result", () => {
    const t = svc.create({ title: "a" });
    expect(svc.remove(t.id)).toBe(true);
    expect(svc.remove(t.id)).toBe(false);
    expect(svc.getAll()).toHaveLength(0);
  });

  test("BUG #5: ignores protected and unknown fields", () => {
    const t = svc.create({ title: "a" });
    const u = svc.update(t.id, {
      id: "hacked",
      createdAt: "2000-01-01T00:00:00.000Z",
      completedAt: "2000-01-01T00:00:00.000Z",
      assignee: "sneaky",
      hack: true,
      title: "b",
    });
    expect(u.title).toBe("b");
    expect(u.id).toBe(t.id);
    expect(u.createdAt).toBe(t.createdAt);
    expect(u.completedAt).toBeNull();
    expect(u.assignee).toBeNull();
    expect(u.hack).toBeUndefined();
  });

  test("moving to done sets completedAt; moving back clears it", () => {
    const t = svc.create({ title: "a" });
    expect(svc.update(t.id, { status: "done" }).completedAt).not.toBeNull();
    expect(svc.update(t.id, { status: "todo" }).completedAt).toBeNull();
  });

  test("update keeps completedAt when status stays done", () => {
    const t = svc.create({ title: "a" });
    const first = svc.update(t.id, { status: "done" });
    const second = svc.update(t.id, { status: "done", title: "b" });
    expect(second.completedAt).toBe(first.completedAt);
  });

  test("dueDate can be cleared with null", () => {
    const t = svc.create({ title: "a", dueDate: "2026-10-05T10:00:00.000Z" });
    expect(svc.update(t.id, { dueDate: null }).dueDate).toBeNull();
  });
});

describe("completeTask", () => {
  test("sets status and completedAt, preserves priority", () => {
    const t = svc.create({ title: "a", priority: "high" });
    const done = svc.completeTask(t.id);
    expect(done.status).toBe("done");
    expect(done.completedAt).not.toBeNull();
    expect(done.priority).toBe("high");
  });

  test("returns null for unknown id", () => {
    expect(svc.completeTask("nope")).toBeNull();
  });

  test("BUG #6: completing twice keeps the original completedAt", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
    const t = svc.create({ title: "a" });
    const first = svc.completeTask(t.id);

    jest.setSystemTime(new Date("2026-10-02T10:00:00.000Z"));
    const second = svc.completeTask(t.id);

    expect(first.completedAt).toBe("2026-10-01T10:00:00.000Z");
    expect(second.completedAt).toBe(first.completedAt);
  });
});

describe("assign", () => {
  test("stores trimmed assignee", () => {
    const t = svc.create({ title: "a" });
    expect(svc.assign(t.id, "  Riyaz ").assignee).toBe("Riyaz");
  });

  test("returns null for unknown id", () => {
    expect(svc.assign("nope", "x")).toBeNull();
  });
});
