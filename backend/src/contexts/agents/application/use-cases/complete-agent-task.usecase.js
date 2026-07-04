const { AgentTaskNotFoundError, AgentTaskAlreadyClosedError } = require("../../domain/errors");

function createCompleteAgentTaskUseCase({ agentTaskRepository, eventPublisher }) {
  return async function execute({ agentTaskId, result = null }) {
    const task = await agentTaskRepository.findById(agentTaskId);
    if (!task) throw new AgentTaskNotFoundError(agentTaskId);
    if (task.status !== "en_proceso") throw new AgentTaskAlreadyClosedError(agentTaskId, task.status);

    const completed = await agentTaskRepository.complete(agentTaskId, result);
    await eventPublisher.publish("TareaCompletada", { task: completed });
    return { task: completed };
  };
}
module.exports = { createCompleteAgentTaskUseCase };
