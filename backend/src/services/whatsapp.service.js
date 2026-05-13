const verifyWebhookSignature = (mode, token, challenge) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return challenge;
  }

  return null;
};

const processIncomingMessage = async (body) => {
  console.log("[WhatsApp] Mensaje entrante:", JSON.stringify(body, null, 2));

  return { received: true };
};

module.exports = {
  verifyWebhookSignature,
  processIncomingMessage,
};
