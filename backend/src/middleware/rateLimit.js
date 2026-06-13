const rateLimit = require("express-rate-limit");

const rateLimitMessage = "Demasiadas solicitudes, intenta más tarde";

const createLimiter = (max) =>
  rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).send(rateLimitMessage);
    },
  });

const testRateLimit = createLimiter(20);
const dashboardRateLimit = createLimiter(60);
const webhookRateLimit = createLimiter(100);

module.exports = {
  testRateLimit,
  dashboardRateLimit,
  webhookRateLimit,
};
