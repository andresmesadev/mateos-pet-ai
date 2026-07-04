const { AgentTaskNotFoundError } = require("../../domain/errors");

function createGetAgentDecisionsUseCase({ agentTaskRepository, agentDecisionRepository }) {
  return async function execute({ agentTaskId }) {
    const task = await agentTaskRepository.findById(agentTaskId);
    if (!task) throw new AgentTaskNotFoundError(agentTaskId);
    const decisions = await agentDecisionRepository.listByTask(agentTaskId);
    return { decisions };
  };
}
module.exports = { createGetAgentDecisionsUseCase };
