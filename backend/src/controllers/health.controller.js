const { getHealthStatus } = require("../services/health.service");

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
      },
      version: "1.1.0",
    });
  }
};

module.exports = {
  getHealth,
};
