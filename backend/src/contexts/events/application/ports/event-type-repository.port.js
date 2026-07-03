class EventTypeRepositoryPort {
  async create(_data) {
    throw new Error("EventTypeRepositoryPort.create no implementado");
  }
  async findByName(_name) {
    throw new Error("EventTypeRepositoryPort.findByName no implementado");
  }
  async deactivate(_id) {
    throw new Error("EventTypeRepositoryPort.deactivate no implementado");
  }
  async listActive() {
    throw new Error("EventTypeRepositoryPort.listActive no implementado");
  }
}

module.exports = { EventTypeRepositoryPort };
