const { DomainEventNotFoundError } = require("../../domain/errors");

/**
 * ListEventDeliveriesUseCase — Consulta. Caso de uso 8 (Etapa 2).
 * Consulta las Entregas de un Evento de Dominio determinado.
 */
function createListEventDeliveriesUseCase({ domainEventRepository, eventDeliveryRepository }) {
  return async function execute({ domainEventId }) {
    const domainEvent = await domainEventRepository.findById(domainEventId);
    if (!domainEvent) {
      throw new DomainEventNotFoundError(domainEventId);
    }

    const deliveries = await eventDeliveryRepository.listByDomainEvent(domainEventId);
    return { deliveries };
  };
}

module.exports = { createListEventDeliveriesUseCase };
