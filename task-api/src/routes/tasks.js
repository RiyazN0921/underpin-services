const express = require("express");
const router = express.Router();
const taskService = require("../services/taskService");
const {
  validateCreateTask,
  validateUpdateTask,
  validateAssign,
} = require("../utils/validators");

router.get("/stats", (req, res) => {
  res.json(taskService.getStats());
});

router.get("/", (req, res) => {
  const { status, page, limit } = req.query;

  if (page !== undefined || limit !== undefined) {
    const pageNum = page === undefined ? 1 : Number(page);
    const limitNum = limit === undefined ? 10 : Number(limit);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: "page must be a positive integer" });
    }
    if (!Number.isInteger(limitNum) || limitNum < 1) {
      return res
        .status(400)
        .json({ error: "limit must be a positive integer" });
    }
    return res.json(taskService.getPaginated(pageNum, limitNum, status));
  }

  if (status) {
    return res.json(taskService.getByStatus(status));
  }

  res.json(taskService.getAll());
});

router.post("/", (req, res) => {
  const error = validateCreateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.create(req.body);
  res.status(201).json(task);
});

router.put("/:id", (req, res) => {
  const error = validateUpdateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.update(req.params.id, req.body);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  res.json(task);
});

router.delete("/:id", (req, res) => {
  const deleted = taskService.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Task not found" });
  }

  res.status(204).send();
});

router.patch("/:id/complete", (req, res) => {
  const task = taskService.completeTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  res.json(task);
});

router.patch("/:id/assign", (req, res) => {
  const error = validateAssign(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.assign(req.params.id, req.body.assignee);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  res.json(task);
});

module.exports = router;
