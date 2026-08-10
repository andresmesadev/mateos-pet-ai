const { AgentTaskNotFoundError } = require("../../domain/errors");

function createGetAgentDecisionsUseCase({ agentTaskRepository, agentDecisionRepository }) {
  return async function execute({ agentTaskId, tenantId = null }) {
    const task = await agentTaskRepository.findById(agentTaskId);
    const ownerTenantId = task?.digitalEmployee?.tenantId ?? null;
    if (!task || (tenantId && ownerTenantId !== tenantId)) {
      throw new AgentTaskNotFoundError(agentTaskId);
    }
    const decisions = await agentDecisionRepository.listByTask(agentTaskId);
    return { decisions };
  };
}
module.exports = { createGetAgentDecisionsUseCase };
