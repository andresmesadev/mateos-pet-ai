const { AgentTaskNotFoundError, AgentTaskAlreadyClosedError, InvalidAgentDecisionAttributesError } = require("../../domain/errors");

/**
 * RegisterAgentDecisionUseCase (Registrar Decisión) — Operación (reactivo). Caso 6.
 * Invariante §9: DecisiónRegistrada se produce siempre, sin excepción.
 */
function createRegisterAgentDecisionUseCase({ agentTaskRepository, agentDecisionRepository, eventPublisher }) {
  return async function execute({ agentTaskId, input, reasoning, action }) {
    if (!reasoning || !reasoning.trim()) {
      throw new InvalidAgentDecisionAttributesError("reasoning es obligatorio.");
    }
    if (!action || !action.trim()) {
      throw new InvalidAgentDecisionAttributesError("action es obligatorio.");
    }
    const task = await agentTaskRepository.findById(agentTaskId);
    if (!task) throw new AgentTaskNotFoundError(agentTaskId);
    if (task.status !== "en_proceso") throw new AgentTaskAlreadyClosedError(agentTaskId, task.status);

    const decision = await agentDecisionRepository.create({
      agentTaskId,
      input: input ?? null,
      reasoning: reasoning.trim(),
      action: action.trim(),
    });
    await eventPublisher.publish("DecisiónRegistrada", { decision });
    return { decision };
  };
}
module.exports = { createRegisterAgentDecisionUseCase };
