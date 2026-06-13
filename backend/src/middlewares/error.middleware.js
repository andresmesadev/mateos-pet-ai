const logger = require("../lib/logger");
const { captureException } = require("../lib/sentry");

const errorHandler = (err, req, res, next) => {
  const statusCode =
    err?.statusCode && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;

  logger.error("Unhandled request error", {
    message: err?.message,
    stack: err?.stack,
    path: req?.path,
    method: req?.method,
    statusCode,
  });

  captureException(err, {
    path: req?.path,
    method: req?.method,
    statusCode,
  });

  if (statusCode >= 500) {
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }

  return res.status(statusCode).json({
    success: false,
    message: err?.message || "Error en la solicitud",
  });
};

module.exports = errorHandler;
