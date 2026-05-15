const {
  verifyWebhookSignature,
  processIncomingMessage,
} = require("../services/whatsapp.service");
const { sendWhatsAppMessage } = require("../services/whatsapp-api.service");

const verifyWebhook = (req, res, next) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const result = verifyWebhookSignature(mode, token, challenge);

    if (result != null && result !== "") {
      console.log("[WhatsApp] Webhook verificado correctamente");
      return res.status(200).type("text/plain").send(result);
    }

    return res.sendStatus(403);
  } catch (error) {
    next(error);
  }
};

const receiveWebhook = async (req, res, next) => {
  try {
    const result = await processIncomingMessage(req.body);

    if (result?.processed && result?.from && result?.reply) {
      console.log(
        `[WhatsApp] Preparando envío a ${result.from}:`,
        result.reply
      );

      const apiResponse = await sendWhatsAppMessage(result.from, result.reply);

      if (!apiResponse) {
        console.error(
          `[WhatsApp] No se pudo enviar respuesta a ${result.from}`
        );
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyWebhook,
  receiveWebhook,
};
