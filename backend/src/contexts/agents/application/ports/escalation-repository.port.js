class EscalationRepositoryPort {
  async create(_data) { throw new Error("EscalationRepositoryPort.create no implementado"); }
  async findById(_id) { throw new Error("EscalationRepositoryPort.findById no implementado"); }
  async resolve(_id) { throw new Error("EscalationRepositoryPort.resolve no implementado"); }
  async listPending(_tenantId) { throw new Error("EscalationRepositoryPort.listPending no implementado"); }
}
module.exports = { EscalationRepositoryPort };
