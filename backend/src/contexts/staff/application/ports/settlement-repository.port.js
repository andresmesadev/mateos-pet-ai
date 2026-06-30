class SettlementRepositoryPort {
  async findActiveByStaffAndPeriod(_staffId, _periodStart, _periodEnd) {
    throw new Error("SettlementRepositoryPort.findActiveByStaffAndPeriod no implementado");
  }
  async create(_data) {
    throw new Error("SettlementRepositoryPort.create no implementado");
  }
  async list(_filter) {
    throw new Error("SettlementRepositoryPort.list no implementado");
  }
}

module.exports = { SettlementRepositoryPort };
