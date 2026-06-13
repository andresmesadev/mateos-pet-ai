const fs = require("fs");
const path = require("path");
const winston = require("winston");
const { formatInTimeZone } = require("date-fns-tz");

const TIMEZONE = "America/Bogota";
const isProduction = process.env.NODE_ENV === "production";
const logLevel = String(process.env.LOG_LEVEL || "info").trim().toLowerCase();

const logsDir = path.join(__dirname, "..", "..", "logs");

if (isProduction && !fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const bogotaTimestamp = winston.format((info) => {
  info.timestamp = formatInTimeZone(
    new Date(),
    TIMEZONE,
    "yyyy-MM-dd'T'HH:mm:ss.SSS"
  );
  info.timezone = TIMEZONE;
  return info;
});

const developmentFormat = winston.format.combine(
  bogotaTimestamp(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, timezone, ...meta }) => {
    const metaKeys = Object.keys(meta).filter(
      (key) => !["level", "splat", "stack"].includes(key)
    );
    const metaPayload = metaKeys.length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${timezone} [${level}] ${message}${metaPayload}`;
  })
);

const productionFormat = winston.format.combine(
  bogotaTimestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: isProduction ? productionFormat : developmentFormat,
  }),
];

if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      format: productionFormat,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      format: productionFormat,
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  levels: winston.config.npm.levels,
  transports,
  exitOnError: false,
});

module.exports = logger;
