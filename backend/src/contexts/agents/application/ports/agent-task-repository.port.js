class AgentTaskRepositoryPort {
  async create(_data) { throw new Error("AgentTaskRepositoryPort.create no implementado"); }
  async findById(_id) { throw new Error("AgentTaskRepositoryPort.findById no implementado"); }
  async complete(_id, _result) { throw new Error("AgentTaskRepositoryPort.complete no implementado"); }
  async escalate(_id) { throw new Error("AgentTaskRepositoryPort.escalate no implementado"); }
  async listByEmployee(_digitalEmployeeId) { throw new Error("AgentTaskRepositoryPort.listByEmployee no implementado"); }
}
module.exports = { AgentTaskRepositoryPort };
