class AgentDecisionRepositoryPort {
  async create(_data, _ctx) { throw new Error("AgentDecisionRepositoryPort.create no implementado"); }
  async listByTask(_agentTaskId) { throw new Error("AgentDecisionRepositoryPort.listByTask no implementado"); }
}
module.exports = { AgentDecisionRepositoryPort };
