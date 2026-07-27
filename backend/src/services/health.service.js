const OpenAI = require("openai");
const prisma = require("../lib/prisma");

const APP_VERSION = "2.16.0";

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

  const services = { database, openai };
  const status =
    database === "ok" && openai === "ok" ? "ok" : "degraded";

  return {
    status,
    timestamp: new Date().toISOString(),
    services,
    version: APP_VERSION,
  };
};

module.exports = {
  getHealthStatus,
};
