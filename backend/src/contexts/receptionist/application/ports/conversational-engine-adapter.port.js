/**
 * ConversationalEngineAdapterPort — frontera hacia el motor conversacional
 * legado (whatsapp.service.js y todo lo que orquesta). Etapa 3, sección 1:
 * si el motor se reescribe o se relocaliza en el futuro (Decisión Diferida 4
 * de la Etapa 1), solo cambia su implementación, nunca el caso de uso.
 */
class ConversationalEngineAdapterPort {
  async processIncomingMessage(_body) {
    throw new Error("ConversationalEngineAdapterPort.processIncomingMessage no implementado");
  }
}

module.exports = { ConversationalEngineAdapterPort };
