const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { initSentry } = require("./lib/sentry");
initSentry();

const logger = require("./lib/logger");
const routes = require("./routes");
const webhookRoutes = require("./routes/webhook.routes");
const parseWebhookBody = require("./middleware/parseWebhookBody");
const {
  testRateLimit,
  dashboardRateLimit,
  webhookRateLimit,
} = require("./middleware/rateLimit");

const errorHandler = require("./middlewares/error.middleware");
const { startReminderJob } = require("./jobs/reminder.job");
const { router: billingRouter, webhookHandler } = require("./routes/billing.routes");
const onboardingRoutes = require("./routes/onboarding.routes");

const app = express();

// Necesario para que express-rate-limit confíe en la IP real detrás de ngrok/proxy
app.set("trust proxy", 1);

const webhookRawParser = express.raw({ type: "application/json" });

app.use(cors());

// Rutas con raw body — deben ir ANTES de express.json()
app.use("/webhook", webhookRateLimit, webhookRawParser, parseWebhookBody, webhookRoutes);
app.use("/api/webhook", webhookRateLimit, webhookRawParser, parseWebhookBody, webhookRoutes);
// Stripe webhook: raw body requerido para verificar firma (stripe-signature)
app.post("/api/billing/webhook", webhookRawParser, webhookHandler);

app.use(express.json());

app.use("/api/test", testRateLimit);

app.get("/", (req, res) => {
  res.send("Mateos Pet AI funcionando 🚀");
});

const dashboardRoutes = require("./routes/dashboard.routes");

app.use("/api", routes);

const { resolveTenant } = require("./middleware/resolveTenant");
app.use("/api/dashboard", dashboardRateLimit, resolveTenant, dashboardRoutes);
app.use("/api/billing", billingRouter);
app.use("/api/onboarding", onboardingRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info("Servidor iniciado", { port: PORT, env: process.env.NODE_ENV || "development" });
  startReminderJob();
});
