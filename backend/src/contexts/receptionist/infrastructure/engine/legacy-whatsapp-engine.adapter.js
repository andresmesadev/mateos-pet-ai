const { processIncomingMessage } = require("../../../../services/whatsapp.service");
const { ConversationalEngineAdapterPort } = require("../../application/ports/conversational-engine-adapter.port");

/**
 * Satisface ConversationalEngineAdapterPort delegando exclusivamente en el
 * motor conversacional existente (whatsapp.service.js) — sin modificarlo
 * (Etapa 1, Decisión 3; Etapa 3, sección 1).
 */
class LegacyWhatsappEngineAdapter extends ConversationalEngineAdapterPort {
  async processIncomingMessage(body) {
    return processIncomingMessage(body);
  }
}

module.exports = { LegacyWhatsappEngineAdapter };
