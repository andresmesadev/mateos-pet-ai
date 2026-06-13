/**
 * Convierte el body raw (Buffer) del webhook en JSON y conserva req.rawBody
 * para validación HMAC (X-Hub-Signature-256).
 */
const parseWebhookBody = (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.rawBody = req.body;

    try {
      req.body = JSON.parse(req.body.toString("utf8"));
    } catch (error) {
      console.error("[Webhook] Invalid JSON body:", error.message);
      return res.status(400).json({ error: "Invalid JSON" });
    }

    return next();
  }

  if (!req.rawBody) {
    req.rawBody = Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
  }

  return next();
};

module.exports = parseWebhookBody;
