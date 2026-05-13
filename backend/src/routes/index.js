const express = require("express");
const healthRoutes = require("./health.routes");
const errorRoutes = require("./error.routes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/error", errorRoutes);

module.exports = router;
