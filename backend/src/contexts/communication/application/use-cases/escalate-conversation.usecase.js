const { ConversationNotFoundError, ConversationAlreadyEscalatedError } = require("../../domain/errors");

/**
 * EscalateConversationUseCase (Escalar Conversación) — Operación (reactivo).
 * Caso de uso 4 (Etapa 2). Reemplaza el flag sessionData.requires_human_attention.
 * Postcondición: status pasa a "esperando_humano"; produce ConversaciónEscalada.
 */
function createEscalateConversationUseCase({ conversationRepository, eventPublisher }) {
  return async function execute({ conversationId }) {
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }
    if (conversation.status === "esperando_humano") {
      throw new ConversationAlreadyEscalatedError(conversationId);
    }

    const escalated = await conversationRepository.escalate(conversationId);

    await eventPublisher.publish("ConversaciónEscalada", { conversation: escalated });

    return { conversation: escalated };
  };
}

module.exports = { createEscalateConversationUseCase };
