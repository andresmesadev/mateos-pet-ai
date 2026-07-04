/**
 * ListEscalatedConversationsUseCase — Consulta. Caso de uso 8 (Etapa 2).
 * Reemplaza getPendingEscalations.
 */
function createListEscalatedConversationsUseCase({ conversationRepository }) {
  return async function execute({ tenantId }) {
    const conversations = await conversationRepository.listEscalatedPending(tenantId ?? null);
    return { conversations };
  };
}

module.exports = { createListEscalatedConversationsUseCase };
