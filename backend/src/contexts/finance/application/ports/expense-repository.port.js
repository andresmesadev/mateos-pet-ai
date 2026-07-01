class ExpenseRepositoryPort {
  async findById(_expenseId) {
    throw new Error("ExpenseRepositoryPort.findById no implementado");
  }
  async create(_data) {
    throw new Error("ExpenseRepositoryPort.create no implementado");
  }
  async void(_expenseId, _data) {
    throw new Error("ExpenseRepositoryPort.void no implementado");
  }
  async listByDateRange(_tenantId, _dateStart, _dateEnd) {
    throw new Error("ExpenseRepositoryPort.listByDateRange no implementado");
  }
}

module.exports = { ExpenseRepositoryPort };
