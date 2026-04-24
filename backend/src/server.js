const express = require("express");
const cors = require("cors");
const { HOST, PORT, FRONTEND_URL, USER_DETAILS } = require("./config");
const { processGraphPayload } = require("./graphService");

const app = express();

app.use(
  cors({
    origin: FRONTEND_URL === "*" ? true : FRONTEND_URL,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Backend is running.",
  });
});

app.post("/bfhl", (req, res, next) => {
  try {
    const result = processGraphPayload(req.body);

    res.json({
      ...USER_DETAILS,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error.",
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Backend listening on http://${HOST}:${PORT}`);
});
