class DomainEventRepositoryPort {
  async create(_data, _ctx) {
    throw new Error("DomainEventRepositoryPort.create no implementado");
  }
  async findById(_id) {
    throw new Error("DomainEventRepositoryPort.findById no implementado");
  }
  async listByFilters(_filters) {
    throw new Error("DomainEventRepositoryPort.listByFilters no implementado");
  }
}

module.exports = { DomainEventRepositoryPort };
