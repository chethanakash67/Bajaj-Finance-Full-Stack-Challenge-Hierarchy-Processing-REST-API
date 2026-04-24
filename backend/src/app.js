const express = require("express");
const cors = require("cors");
const {
  FRONTEND_URL,
  USER_DETAILS,
  HOSTED_FRONTEND_URL,
  HOSTED_API_URL,
  GITHUB_REPO_URL,
} = require("./config");
const { processGraphPayload } = require("./graphService");

function ensureJsonContentType(request) {
  return request.is("application/json")
    ? null
    : {
        success: false,
        message: "Content-Type must be application/json.",
      };
}

function formatAppError(error) {
  if (error instanceof SyntaxError && "body" in error) {
    return {
      statusCode: 400,
      payload: {
        success: false,
        message: "Malformed JSON request body.",
      },
    };
  }

  return {
    statusCode: error.statusCode || 500,
    payload: {
      success: false,
      message: error.message || "Internal server error.",
    },
  };
}

function createApp() {
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
      hosted_frontend_url: HOSTED_FRONTEND_URL,
      hosted_api_url: HOSTED_API_URL,
      github_repo_url: GITHUB_REPO_URL,
    });
  });

  app.post("/bfhl", (req, res, next) => {
    const contentTypeError = ensureJsonContentType(req);

    if (contentTypeError) {
      return res.status(415).json(contentTypeError);
    }

    try {
      const result = processGraphPayload(req.body);

      return res.json({
        ...USER_DETAILS,
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.method} ${req.originalUrl} not found.`,
    });
  });

  app.use((error, _req, res, _next) => {
    const { statusCode, payload } = formatAppError(error);
    return res.status(statusCode).json(payload);
  });

  return app;
}

module.exports = {
  createApp,
  ensureJsonContentType,
  formatAppError,
};
