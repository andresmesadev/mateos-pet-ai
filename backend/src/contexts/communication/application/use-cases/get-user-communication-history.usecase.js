/**
 * GetUserCommunicationHistoryUseCase — Consulta. Caso de uso 7 (Etapa 2).
 * Con la migración de la Decisión 3 completa, incluye por primera vez
 * recordatorios y notificaciones, no solo mensajes conversacionales.
 */
function createGetUserCommunicationHistoryUseCase({ messageRepository }) {
  return async function execute({ userId }) {
    const messages = await messageRepository.listByUser(userId);
    return { messages };
  };
}

module.exports = { createGetUserCommunicationHistoryUseCase };
