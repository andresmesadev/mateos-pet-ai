class FinancialPeriodRepositoryPort {
  async findByRange(_tenantId, _periodStart, _periodEnd) {
    throw new Error("FinancialPeriodRepositoryPort.findByRange no implementado");
  }
  async create(_data) {
    throw new Error("FinancialPeriodRepositoryPort.create no implementado");
  }
}

module.exports = { FinancialPeriodRepositoryPort };
