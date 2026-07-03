const { InvalidEventTypeAttributesError, DuplicateEventTypeNameError } = require("../../domain/errors");

/**
 * RegisterEventTypeUseCase — Administración. Caso de uso 1 (Etapa 2).
 * Da de alta un Tipo de Evento en el Catálogo — el vocabulario oficial de
 * disparadores posibles (consumido más adelante por Automatizaciones, 3.3).
 *
 * @param {Object} deps
 * @param {import("../ports/event-type-repository.port").EventTypeRepositoryPort} deps.eventTypeRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createRegisterEventTypeUseCase({ eventTypeRepository, eventPublisher }) {
  return async function execute({ name, originContext, payloadContractDescription }) {
    if (!name || !name.trim()) {
      throw new InvalidEventTypeAttributesError("name es obligatorio.");
    }
    if (!originContext || !originContext.trim()) {
      throw new InvalidEventTypeAttributesError("originContext es obligatorio.");
    }

    const existing = await eventTypeRepository.findByName(name.trim());
    if (existing) {
      throw new DuplicateEventTypeNameError(name.trim());
    }

    const eventType = await eventTypeRepository.create({
      name: name.trim(),
      originContext: originContext.trim(),
      payloadContractDescription: payloadContractDescription ?? null,
      active: true,
    });

    await eventPublisher.publish("TipoDeEventoRegistrado", { eventType });

    return { eventType };
  };
}

module.exports = { createRegisterEventTypeUseCase };
