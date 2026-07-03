const { InvalidDomainEventAttributesError, EventTypeNotFoundError, EventTypeNotActiveError } = require("../../domain/errors");

/**
 * RegisterDomainEventUseCase — Operación (reactivo). Caso de uso 3 (Etapa 2).
 * Certifica un hecho ya ocurrido en cualquier contexto productor como
 * Evento de Dominio. Invariante 2: el Tipo de Evento debe existir y estar
 * activo. Invariante 6: la validez del evento no depende de que existan
 * consumidores — este caso de uso nunca verifica ni exige suscriptores.
 *
 * Este es el punto de certificación que, según la Arquitectura Técnica
 * (Etapa 3), se invoca como parte del cierre exitoso de la misma transacción
 * lógica del comando que produjo el hecho — no como "un handler más".
 *
 * @param {Object} deps
 * @param {import("../ports/domain-event-repository.port").DomainEventRepositoryPort} deps.domainEventRepository
 * @param {import("../ports/event-type-repository.port").EventTypeRepositoryPort} deps.eventTypeRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createRegisterDomainEventUseCase({ domainEventRepository, eventTypeRepository, eventPublisher }) {
  return async function execute({ tenantId, eventTypeName, payload, origin, occurredAt }, ctx) {
    if (!tenantId) {
      throw new InvalidDomainEventAttributesError("tenantId es obligatorio (Invariante 4).");
    }
    if (!eventTypeName) {
      throw new InvalidDomainEventAttributesError("eventTypeName es obligatorio.");
    }
    if (!origin || !origin.trim()) {
      throw new InvalidDomainEventAttributesError("origin es obligatorio.");
    }

    const eventType = await eventTypeRepository.findByName(eventTypeName);
    if (!eventType) {
      throw new EventTypeNotFoundError(eventTypeName);
    }
    if (!eventType.active) {
      throw new EventTypeNotActiveError(eventTypeName);
    }

    const domainEvent = await domainEventRepository.create(
      {
        tenantId,
        eventTypeId: eventType.id,
        payload: payload ?? null,
        origin: origin.trim(),
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
      ctx
    );

    await eventPublisher.publish("EventoDeDominioRegistrado", { domainEvent });

    return { domainEvent };
  };
}

module.exports = { createRegisterDomainEventUseCase };
