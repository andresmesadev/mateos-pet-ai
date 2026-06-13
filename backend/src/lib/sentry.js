const Sentry = require("@sentry/node");

let enabled = false;

const initSentry = () => {
  const dsn = String(process.env.SENTRY_DSN || "").trim();

  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  });

  enabled = true;
  return true;
};

const captureException = (error, context = {}) => {
  if (!enabled || !error) {
    return;
  }

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        scope.setExtra(key, value);
      }
    });

    Sentry.captureException(error);
  });
};

module.exports = {
  initSentry,
  captureException,
};
