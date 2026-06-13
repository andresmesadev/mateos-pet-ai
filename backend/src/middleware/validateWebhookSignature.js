const crypto = require("crypto");

/**
 * Valida X-Hub-Signature-256 de Meta (HMAC SHA256 del body raw).
 * Solo aplica a POST del webhook de WhatsApp.
 */
const validateWebhookSignature = (req, res, next) => {
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || "").trim();

  if (!appSecret) {
    console.error("[Webhook] WHATSAPP_APP_SECRET is not configured");
    return res.sendStatus(401);
  }

  const signatureHeader = req.headers["x-hub-signature-256"];

  if (!signatureHeader || typeof signatureHeader !== "string") {
    console.warn("[Webhook] Missing X-Hub-Signature-256 header");
    return res.sendStatus(401);
  }

  const [algorithm, receivedHash] = signatureHeader.split("=");

  if (algorithm !== "sha256" || !receivedHash) {
    console.warn("[Webhook] Invalid X-Hub-Signature-256 format");
    return res.sendStatus(401);
  }

  const rawBody = req.rawBody;

  if (!Buffer.isBuffer(rawBody)) {
    console.warn("[Webhook] Missing raw body for signature validation");
    return res.sendStatus(401);
  }

  const expectedHash = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const receivedBuffer = Buffer.from(receivedHash, "utf8");
  const expectedBuffer = Buffer.from(expectedHash, "utf8");

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    console.warn("[Webhook] Invalid webhook signature");
    return res.sendStatus(401);
  }

  return next();
};

module.exports = validateWebhookSignature;
