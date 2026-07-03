const { DomainEventNotFoundError } = require("../../domain/errors");

/**
 * retryEventDelivery — operación de infraestructura, NO un caso de uso de
 * negocio (mismo ajuste que register-event-delivery.mechanism.js).
 * Crea una nueva Entrega de Evento para un consumidor con una entrega previa
 * fallida — nunca reescribe el resultado anterior (Invariante 3).
 *
 * @param {Object} deps
 * @param {import("../ports/domain-event-repository.port").DomainEventRepositoryPort} deps.domainEventRepository
 * @param {import("../ports/event-delivery-repository.port").EventDeliveryRepositoryPort} deps.eventDeliveryRepository
 * @param {{ registerEventDelivery: Function }} deps.registerEventDeliveryMechanism
 */
function createRetryEventDeliveryMechanism({ domainEventRepository, eventDeliveryRepository, registerEventDeliveryMechanism }) {
  return async function retryEventDelivery({ domainEventId, consumer, status, failureReason = null }) {
    const domainEvent = await domainEventRepository.findById(domainEventId);
    if (!domainEvent) {
      throw new DomainEventNotFoundError(domainEventId);
    }

    const lastFailed = await eventDeliveryRepository.findLastFailedForConsumer(domainEventId, consumer);
    if (!lastFailed) {
      throw new Error(
        `retryEventDelivery: no existe una Entrega de Evento fallida previa para el consumidor "${consumer}" del evento "${domainEventId}".`
      );
    }

    return registerEventDeliveryMechanism({ domainEventId, consumer, status, failureReason });
  };
}

module.exports = { createRetryEventDeliveryMechanism };
