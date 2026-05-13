const express = require("express");
const healthRoutes = require("./health.routes");
const errorRoutes = require("./error.routes");
const webhookRoutes = require("./webhook.routes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/error", errorRoutes);
router.use("/webhook", webhookRoutes);

module.exports = router;
