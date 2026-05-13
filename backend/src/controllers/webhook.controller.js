const {
  verifyWebhookSignature,
  processIncomingMessage,
} = require("../services/whatsapp.service");

const verifyWebhook = (req, res, next) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const result = verifyWebhookSignature(mode, token, challenge);

    if (result) {
      console.log("[WhatsApp] Webhook verificado correctamente");
      return res.status(200).send(result);
    }

    return res.sendStatus(403);
  } catch (error) {
    next(error);
  }
};

const receiveWebhook = async (req, res, next) => {
  try {
    await processIncomingMessage(req.body);
    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyWebhook,
  receiveWebhook,
};
