const VALID_STATUSES = ["todo", "in_progress", "done"];
const VALID_PRIORITIES = ["low", "medium", "high"];
const MAX_ASSIGNEE_LENGTH = 100;

const isObject = (body) =>
  body !== null && typeof body === "object" && !Array.isArray(body);

const validateFields = (body, { requireTitle }) => {
  if (!isObject(body)) {
    return "request body must be a JSON object";
  }

  if (requireTitle || body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim() === "") {
      return requireTitle
        ? "title is required and must be a non-empty string"
        : "title must be a non-empty string";
    }
  }
  if (body.description !== undefined && typeof body.description !== "string") {
    return "description must be a string";
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(", ")}`;
  }
  if (
    body.priority !== undefined &&
    !VALID_PRIORITIES.includes(body.priority)
  ) {
    return `priority must be one of: ${VALID_PRIORITIES.join(", ")}`;
  }
  if (body.dueDate !== undefined && body.dueDate !== null) {
    if (typeof body.dueDate !== "string" || isNaN(Date.parse(body.dueDate))) {
      return "dueDate must be a valid ISO date string";
    }
  }
  return null;
};

const validateCreateTask = (body) =>
  validateFields(body, { requireTitle: true });

const validateUpdateTask = (body) =>
  validateFields(body, { requireTitle: false });

const validateAssign = (body) => {
  const assignee = isObject(body) ? body.assignee : undefined;
  if (typeof assignee !== "string" || assignee.trim() === "") {
    return "assignee is required and must be a non-empty string";
  }
  if (assignee.trim().length > MAX_ASSIGNEE_LENGTH) {
    return `assignee must be at most ${MAX_ASSIGNEE_LENGTH} characters`;
  }
  return null;
};

module.exports = { validateCreateTask, validateUpdateTask, validateAssign };
