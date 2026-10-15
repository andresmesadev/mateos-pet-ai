const { InvalidDomainEventAttributesError, EventTypeNotFoundError, EventTypeNotActiveError } = require("../../domain/errors");
const { isDeepStrictEqual } = require('node:util');

function sameEnvelope(event, expected) {
  return event.tenantId === expected.tenantId && event.eventTypeId === expected.eventTypeId &&
    event.origin === expected.origin && new Date(event.occurredAt).getTime() === expected.occurredAt.getTime() &&
    isDeepStrictEqual(JSON.parse(JSON.stringify(event.payload)), JSON.parse(JSON.stringify(expected.payload)));
}

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
 * @param {{ notify: Function }} [deps.reactor] Entregable 5.4 — punto de
 * extensión genérico e inerte por defecto: quien construya este caso de uso
 * puede sustituir `reactor.notify` para reaccionar a cualquier Evento de
 * Dominio certificado (independientemente de su contexto productor), sin que
 * este caso de uso conozca quién lo consume. Su fallo nunca se propaga —
 * misma garantía de no-propagación que ya rige toda la certificación.
 */
function createRegisterDomainEventUseCase({
  domainEventRepository,
  eventTypeRepository,
  eventPublisher,
  reactor = { notify: async () => {} },
}) {
  return async function execute({ id, dispatch, tenantId, eventTypeName, payload, origin, occurredAt }, ctx) {
    if (!tenantId) {
      throw new InvalidDomainEventAttributesError("tenantId es obligatorio (Invariante 4).");
    }
    if (!eventTypeName) {
      throw new InvalidDomainEventAttributesError("eventTypeName es obligatorio.");
    }
    if (!origin || !origin.trim()) {
      throw new InvalidDomainEventAttributesError("origin es obligatorio.");
    }

    if (dispatch !== undefined && dispatch !== 'deferred') throw new InvalidDomainEventAttributesError('dispatch no reconocido.');
    if (id !== undefined && (typeof id !== 'string' || !id || dispatch !== 'deferred' || !occurredAt)) {
      throw new InvalidDomainEventAttributesError('La identidad estable exige certificación diferida y fecha explícita.');
    }
    const eventDate = occurredAt ? new Date(occurredAt) : new Date();
    if (!Number.isFinite(eventDate.getTime())) throw new InvalidDomainEventAttributesError('occurredAt no es válido.');
    const eventType = await eventTypeRepository.findByName(eventTypeName, ctx);
    if (!eventType) {
      throw new EventTypeNotFoundError(eventTypeName);
    }
    const envelope = { tenantId, eventTypeId: eventType.id, payload: payload ?? null, origin: origin.trim(), occurredAt: eventDate };
    if (id) {
      const previous = await domainEventRepository.findById(id, ctx);
      if (previous) {
        if (!sameEnvelope(previous, envelope)) throw new InvalidDomainEventAttributesError('La identidad del evento pertenece a otro contenido.');
        return { domainEvent: previous, replayed: true };
      }
    }
    if (!eventType.active) {
      throw new EventTypeNotActiveError(eventTypeName);
    }

    const domainEvent = await domainEventRepository.create(
      {
        ...envelope,
        ...(id ? { id } : {}),
      },
      ctx
    );

    await eventPublisher.publish("EventoDeDominioRegistrado", { domainEvent });

    if (dispatch === 'deferred') return { domainEvent, replayed: false };

    try {
      await reactor.notify({ domainEvent, eventTypeName, payload }, ctx);
    } catch (error) {
      // Nunca debe romper la certificación del Evento de Dominio ya persistido.
      console.error(`[Eventos] Reactor genérico falló para "${eventTypeName}" — no propagado`, error.message);
    }

    return { domainEvent };
  };
}

module.exports = { createRegisterDomainEventUseCase };
