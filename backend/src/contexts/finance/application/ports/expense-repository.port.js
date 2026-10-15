class ExpenseRepositoryPort {
  async findById(_expenseId, _ctx) {
    throw new Error("ExpenseRepositoryPort.findById no implementado");
  }
  async create(_data, _ctx) {
    throw new Error("ExpenseRepositoryPort.create no implementado");
  }
  async void(_expenseId, _data, _ctx) {
    throw new Error("ExpenseRepositoryPort.void no implementado");
  }
  async listByDateRange(_tenantId, _dateStart, _dateEnd, _ctx) {
    throw new Error("ExpenseRepositoryPort.listByDateRange no implementado");
  }
}

module.exports = { ExpenseRepositoryPort };
