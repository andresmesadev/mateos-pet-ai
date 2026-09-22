const { getHealthStatus } = require("../services/health.service");
const { version: APP_VERSION } = require("../../package.json");

const getHealth = async (req, res) => {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === "ok" ? 200 : 503;

    return res.status(statusCode).json(health);
  } catch (error) {
    console.error("[Health] Unexpected error:", error.message);

    return res.status(503).json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: "error",
        openai: "error",
        inboundWorker: "error",
      },
      workers: { inbound: { status: "error", healthy: false } },
      version: APP_VERSION,
    });
  }
};

module.exports = {
  getHealth,
};
