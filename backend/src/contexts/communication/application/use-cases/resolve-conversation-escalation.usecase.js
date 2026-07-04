const { ConversationNotFoundError, ConversationNotEscalatedError } = require("../../domain/errors");

/**
 * ResolveConversationEscalationUseCase (Resolver Escalación de Conversación)
 * — Administración. Caso de uso 5 (Etapa 2). Actor humano.
 * Postcondición: status vuelve a "activa".
 */
function createResolveConversationEscalationUseCase({ conversationRepository, eventPublisher }) {
  return async function execute({ conversationId }) {
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }
    if (conversation.status !== "esperando_humano") {
      throw new ConversationNotEscalatedError(conversationId);
    }

    const resolved = await conversationRepository.resolveEscalation(conversationId);

    await eventPublisher.publish("EscalaciónDeConversaciónResuelta", { conversation: resolved });

    return { conversation: resolved };
  };
}

module.exports = { createResolveConversationEscalationUseCase };
