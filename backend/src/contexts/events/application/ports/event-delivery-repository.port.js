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
  /**
   * Entregable 5.1 — Outbox de Eventos de Dominio: descubre, para un
   * consumidor dado, los Eventos de Dominio cuya última Entrega registrada
   * es "failed" — sin esto no existe forma de encontrar entregas pendientes
   * de reintento sin conocer de antemano el domainEventId.
   * @returns {Promise<Array<{id: string, tenantId: string, eventTypeId: string, payload: object}>>}
   */
  async findDomainEventsAwaitingRetry(_consumer) {
    throw new Error("EventDeliveryRepositoryPort.findDomainEventsAwaitingRetry no implementado");
  }
}

module.exports = { EventDeliveryRepositoryPort };
