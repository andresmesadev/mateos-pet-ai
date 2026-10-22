class CashOpeningRepositoryPort {
  async findByDate(_tenantId, _date, _ctx) { throw new Error('Not implemented'); }
  async previousSuggestion(_tenantId, _date, _ctx) { throw new Error('Not implemented'); }
  async save(_data, _ctx) { throw new Error('Not implemented'); }
}
module.exports = { CashOpeningRepositoryPort };
