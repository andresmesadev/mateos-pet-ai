const OpenAI = require("openai");
const prisma = require("../lib/prisma");
const { getInboundWorkerHealth } = require("./operational-health.service");

const { version: APP_VERSION } = require("../../package.json");

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // The public probe gives up after 25 s. Report a dependency failure before
  // that deadline instead of retaining the SDK's 10-minute timeout/retries.
  timeout: 8_000,
  maxRetries: 0,
});

const checkDatabase = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch (error) {
    console.error("[Health] Database check failed:", error.message);
    return "error";
  }
};

const checkOpenAI = async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[Health] OPENAI_API_KEY is not configured");
    return "error";
  }

  try {
    await openaiClient.models.list({ limit: 1 });
    return "ok";
  } catch (error) {
    console.error("[Health] OpenAI check failed:", error.message);
    return "error";
  }
};

const getHealthStatus = async () => {
  const [database, openai] = await Promise.all([
    checkDatabase(),
    checkOpenAI(),
  ]);

  const inboundWorker = getInboundWorkerHealth();
  const services = { database, openai, inboundWorker: inboundWorker.status };
  const status =
    database === "ok" && openai === "ok" && inboundWorker.healthy
      ? "ok"
      : "degraded";

  return {
    status,
    timestamp: new Date().toISOString(),
    services,
    workers: { inbound: inboundWorker },
    version: APP_VERSION,
  };
};

module.exports = {
  getHealthStatus,
};
