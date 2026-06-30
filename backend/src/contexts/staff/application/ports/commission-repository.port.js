class CommissionRepositoryPort {
  async create(_data) {
    throw new Error("CommissionRepositoryPort.create no implementado");
  }
  async listByStaffAndPeriod(_staffId, _periodStart, _periodEnd) {
    throw new Error("CommissionRepositoryPort.listByStaffAndPeriod no implementado");
  }
}

module.exports = { CommissionRepositoryPort };
