const express = require("express");
const healthRoutes = require("./health.routes");
const errorRoutes = require("./error.routes");
const testRoutes = require("./test.routes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/error", errorRoutes);

// Rutas de prueba: invocan OpenAI sin autenticación — nunca en producción
// (hallazgo M2, auditoría v2.1.0).
if (process.env.NODE_ENV !== "production") {
  router.use("/test", testRoutes);
}

module.exports = router;
