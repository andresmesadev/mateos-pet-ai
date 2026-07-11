/**
 * listDomainEventsAwaitingRetry — operación de infraestructura, NO un caso de
 * uso de negocio (mismo estatus que register-event-delivery.mechanism.js y
 * retry-event-delivery.mechanism.js). Entregable 5.1 — Outbox de Eventos de
 * Dominio: descubre, para un consumidor, los Eventos de Dominio cuya última
 * Entrega registrada es "failed", sin exigir conocer de antemano el
 * domainEventId — hueco que impedía cualquier reintento real hasta ahora.
 *
 * @param {Object} deps
 * @param {import("../ports/event-delivery-repository.port").EventDeliveryRepositoryPort} deps.eventDeliveryRepository
 */
function createListDomainEventsAwaitingRetryMechanism({ eventDeliveryRepository }) {
  return async function listDomainEventsAwaitingRetry(consumer) {
    return eventDeliveryRepository.findDomainEventsAwaitingRetry(consumer);
  };
}

module.exports = { createListDomainEventsAwaitingRetryMechanism };
