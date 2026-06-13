const express = require("express");
const cors = require("cors");
require("dotenv").config();

const routes = require("./routes");
const webhookRoutes = require("./routes/webhook.routes");
const parseWebhookBody = require("./middleware/parseWebhookBody");
const {
  testRateLimit,
  dashboardRateLimit,
  webhookRateLimit,
} = require("./middleware/rateLimit");

const errorHandler = require("./middlewares/error.middleware");

const app = express();

const webhookRawParser = express.raw({ type: "application/json" });

app.use(cors());

app.use("/webhook", webhookRateLimit, webhookRawParser, parseWebhookBody, webhookRoutes);
app.use("/api/webhook", webhookRateLimit, webhookRawParser, parseWebhookBody, webhookRoutes);

app.use(express.json());

app.use("/api/test", testRateLimit);

app.get("/", (req, res) => {
  res.send("Mateos Pet AI funcionando 🚀");
});

const dashboardRoutes = require("./routes/dashboard.routes");

app.use("/api", routes);

app.use("/api/dashboard", dashboardRateLimit, dashboardRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});