class EventDeliveryRepositoryPort {
  async create(_data) {
    throw new Error("EventDeliveryRepositoryPort.create no implementado");
  }
  async listByDomainEvent(_domainEventId) {
    throw new Error("EventDeliveryRepositoryPort.listByDomainEvent no implementado");
  }
  async findLastFailedForConsumer(_domainEventId, _consumer) {
    throw new Error("EventDeliveryRepositoryPort.findLastFailedForConsumer no implementado");
  }
}

module.exports = { EventDeliveryRepositoryPort };
