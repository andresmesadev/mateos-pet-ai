const { EscalationNotFoundError, EscalationAlreadyResolvedError } = require("../../domain/errors");

function createAttendEscalationUseCase({ escalationRepository, eventPublisher }) {
  return async function execute({ escalationId, tenantId = null, assignedStaffId = null }) {
    const escalation = await escalationRepository.findById(escalationId);
    const ownerTenantId = escalation?.agentTask?.digitalEmployee?.tenantId ?? null;
    if (!escalation || (tenantId && ownerTenantId !== tenantId)) {
      throw new EscalationNotFoundError(escalationId);
    }
    if (escalation.status === "atendida") throw new EscalationAlreadyResolvedError(escalationId);

    const resolved = await escalationRepository.resolve(escalationId, assignedStaffId);
    await eventPublisher.publish("EscalaciónAtendida", { escalation: resolved });
    return { escalation: resolved };
  };
}
module.exports = { createAttendEscalationUseCase };
