const express = require("express");
const healthRoutes = require("./health.routes");
const errorRoutes = require("./error.routes");
const testRoutes = require("./test.routes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/error", errorRoutes);
router.use("/test", testRoutes);

module.exports = router;
