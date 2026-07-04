const { EscalationNotFoundError, EscalationAlreadyResolvedError } = require("../../domain/errors");

function createAttendEscalationUseCase({ escalationRepository, eventPublisher }) {
  return async function execute({ escalationId, assignedStaffId = null }) {
    const escalation = await escalationRepository.findById(escalationId);
    if (!escalation) throw new EscalationNotFoundError(escalationId);
    if (escalation.status === "atendida") throw new EscalationAlreadyResolvedError(escalationId);

    const resolved = await escalationRepository.resolve(escalationId, assignedStaffId);
    await eventPublisher.publish("EscalaciónAtendida", { escalation: resolved });
    return { escalation: resolved };
  };
}
module.exports = { createAttendEscalationUseCase };
