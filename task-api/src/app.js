const express = require("express");
const taskRoutes = require("./routes/tasks");

const app = express();

app.use(express.json());
app.use("/tasks", taskRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    return res.status(status).json({
      error:
        err.type === "entity.parse.failed" ? "Invalid JSON body" : err.message,
    });
  }
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Task API running on port ${PORT}`);
  });
}

module.exports = app;
