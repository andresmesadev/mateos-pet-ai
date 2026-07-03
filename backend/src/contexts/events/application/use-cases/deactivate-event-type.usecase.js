const { EventTypeNotFoundError, EventTypeAlreadyInactiveError } = require("../../domain/errors");

/**
 * DeactivateEventTypeUseCase — Administración. Caso de uso 2 (Etapa 2).
 * Retira un Tipo de Evento como disparador configurable futuro. No afecta a
 * los Eventos de Dominio ya ocurridos de ese tipo (hechos históricos,
 * inmutables — Invariante 1). Qué ocurre con las Reglas de Automatización que
 * ya lo usaban queda fuera de este contexto — precondición de diseño para 3.3.
 *
 * @param {Object} deps
 * @param {import("../ports/event-type-repository.port").EventTypeRepositoryPort} deps.eventTypeRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createDeactivateEventTypeUseCase({ eventTypeRepository, eventPublisher }) {
  return async function execute({ name }) {
    const eventType = await eventTypeRepository.findByName(name);
    if (!eventType) {
      throw new EventTypeNotFoundError(name);
    }
    if (!eventType.active) {
      throw new EventTypeAlreadyInactiveError(name);
    }

    const deactivated = await eventTypeRepository.deactivate(eventType.id);

    await eventPublisher.publish("TipoDeEventoDesactivado", { eventType: deactivated });

    return { eventType: deactivated };
  };
}

module.exports = { createDeactivateEventTypeUseCase };
