const { AgentTaskNotFoundError, AgentTaskAlreadyClosedError, InvalidEscalationAttributesError } = require("../../domain/errors");

/**
 * GenerateEscalationUseCase (Generar Escalación) — Operación (reactivo). Caso 8.
 * Entidad propia de Empleados Digitales — independiente de Conversation.status
 * (Comunicación, 3.1). Sin integración entre ambas en este entregable
 * (Decisión Diferida, Etapa 1/2).
 */
function createGenerateEscalationUseCase({ agentTaskRepository, escalationRepository, eventPublisher }) {
  return async function execute({ agentTaskId, context, assignedStaffId = null }) {
    if (!context) {
      throw new InvalidEscalationAttributesError("context es obligatorio.");
    }
    const task = await agentTaskRepository.findById(agentTaskId);
    if (!task) throw new AgentTaskNotFoundError(agentTaskId);
    if (task.status !== "en_proceso") throw new AgentTaskAlreadyClosedError(agentTaskId, task.status);

    await agentTaskRepository.escalate(agentTaskId);
    const escalation = await escalationRepository.create({
      agentTaskId,
      assignedStaffId: assignedStaffId ?? null,
      context,
      status: "pendiente",
    });
    await eventPublisher.publish("EscalaciónGenerada", { escalation });
    return { escalation };
  };
}
module.exports = { createGenerateEscalationUseCase };
