function createGetPendingEscalationsUseCase({ escalationRepository }) {
  return async function execute({ tenantId = null } = {}) {
    const escalations = await escalationRepository.listPending(tenantId);
    return { escalations };
  };
}
module.exports = { createGetPendingEscalationsUseCase };
