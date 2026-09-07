const { verifyWebhookSignature, parseIncomingMessage } = require("../services/whatsapp.service");
// Entregable 8.2 (Fase 8) — D-F1: este controlador ya no procesa el mensaje
// inline dentro del ciclo de vida de la petición HTTP. Encola (transacción
// corta) y responde 200 de inmediato; jobs/inbound-message.job.js reclama y
// ejecuta el pipeline real (contexts/receptionist → whatsapp.service.js),
// exactamente el mismo que corría aquí antes de este entregable — sin
// duplicar ni un fragmento de su lógica.
const { enqueueInboundJob } = require("../services/inbound-job.service");

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
    // parseIncomingMessage (no processIncomingMessage) solo para obtener un
    // wamid con el que encolar de forma idempotente — no ejecuta ningún
    // efecto secundario. Payload sin ningún mensaje soportado: nada que
    // encolar, mismo resultado observable que antes (200, sin procesar).
    const parsed = parseIncomingMessage(req.body);

    if (!parsed) {
      return res.sendStatus(200);
    }

    // wamid ausente (no debería ocurrir con Meta real, pero un payload de
    // prueba podría no traerlo): se sintetiza una clave con remitente+hora
    // para no perder el mensaje, al costo de no poder deduplicar ese caso.
    const providerEventId = parsed.wamid || `${parsed.from}:${Date.now()}`;

    await enqueueInboundJob({
      provider: "whatsapp",
      providerEventId,
      payload: req.body,
    });

    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyWebhook,
  receiveWebhook,
};
