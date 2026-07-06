const { verifyWebhookSignature } = require("../services/whatsapp.service");
// Entregable 3.4 — Recepcionista IA: el procesamiento del mensaje entrante ya
// no invoca directamente el motor conversacional (whatsapp.service.js) —
// pasa por el caso de uso Procesar Mensaje Entrante, que da auditoría real
// (Tarea/Decisión/Escalación) sin cambiar el motor ni su comportamiento.
const { processIncomingMessage } = require("../contexts/receptionist");
// Entregable 3.1 — Comunicación: la respuesta del bot pasa exclusivamente
// por Enviar Mensaje. conversationId explícito porque este productor ya
// conoce el hilo exacto al que responde (resuelto por processIncomingMessage).
const { sendMessage } = require("../contexts/communication");

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

    if (result?.processed && result?.from && result?.reply && result?.user?.id) {
      console.log(
        `[WhatsApp] Preparando envío a ${result.from}:`,
        result.reply
      );

      try {
        await sendMessage({
          tenantId: result.user.tenantId ?? null,
          userId: result.user.id,
          conversationId: result.conversation?.id ?? null,
          phone: result.from,
          content: result.reply,
          origin: "agente",
        });
      } catch (error) {
        console.error(
          `[WhatsApp] No se pudo enviar respuesta a ${result.from}:`,
          error.message
        );
      }
    } else if (result?.processed && result?.from && result?.reply) {
      // Caso residual: no se pudo resolver user/conversation (p. ej. fallo en
      // findOrCreateUser). Sin Comunicación no hay a qué conversación
      // adjuntar el mensaje — se registra, no se envía en silencio.
      console.error(
        `[WhatsApp] No se pudo enviar respuesta a ${result.from}: usuario no resuelto`
      );
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
