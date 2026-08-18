const {
  ServiceNotFoundError,
  InvalidPriceError,
  PriceRuleTargetNotFoundError,
  DuplicatePriceRuleError,
} = require("../../domain/errors");

function extractTarget(target) {
  switch (target.type) {
    case "base":
      return { targetType: null, targetId: null };
    case "breed":
      return { targetType: "breed", targetId: target.breedId };
    case "size":
      return { targetType: "size", targetId: target.size };
    case "client":
      return { targetType: "client", targetId: target.clientId };
    case "pet":
      return { targetType: "pet", targetId: target.petId };
    default:
      throw new InvalidPriceError(`target.type "${target.type}" no es válido.`);
  }
}

/**
 * ChangeServicePriceUseCase — Operación.
 * Implementa "Cambiar Precio": única vía autorizada para modificar el precio
 * base o crear/actualizar una regla de precio. El Aggregate Root (Service)
 * es la única puerta de entrada para escribir PriceRule (Principio Permanente 2
 * del modelo de persistencia).
 *
 * Doble protección del invariante "no dos reglas activas para el mismo destino":
 * 1) esta capa valida antes de persistir, 2) el índice único parcial en base de
 * datos garantiza integridad ante condiciones de carrera (Principio Permanente
 * del Esquema Físico).
 *
 * @param {Object} deps
 * @param {import("../ports/service-repository.port").ServiceRepositoryPort} deps.serviceRepository
 * @param {import("../ports/price-rule-repository.port").PriceRuleRepositoryPort} deps.priceRuleRepository
 * @param {import("../ports/target-existence-reader.port").TargetExistenceReaderPort} deps.targetExistenceReader
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createChangeServicePriceUseCase({
  serviceRepository,
  priceRuleRepository,
  targetExistenceReader,
  eventPublisher,
}) {
  return async function execute({ serviceId, tenantId = null, target, newPrice }) {
    if (newPrice == null || Number(newPrice) < 0) {
      throw new InvalidPriceError(newPrice);
    }

    const service = await serviceRepository.findById(serviceId);
    if (!service || (tenantId && service.tenantId !== tenantId)) {
      throw new ServiceNotFoundError(serviceId);
    }

    const { targetType, targetId } = extractTarget(target);

    if (targetType === null) {
      const updatedService = await serviceRepository.update(serviceId, { basePrice: newPrice });
      await eventPublisher.publish("ServicioActualizado", { service: updatedService, appliedRule: null });
      return { service: updatedService, appliedRule: null };
    }

    if (targetType === "client") {
      const exists = await targetExistenceReader.clientExists(targetId, tenantId);
      if (!exists) throw new PriceRuleTargetNotFoundError(targetType, targetId);
    }
    if (targetType === "pet") {
      const exists = await targetExistenceReader.petExists(targetId, tenantId);
      if (!exists) throw new PriceRuleTargetNotFoundError(targetType, targetId);
    }

    const existingRule = await priceRuleRepository.findActiveByTarget(serviceId, targetType, targetId);

    let appliedRule;
    if (existingRule) {
      appliedRule = await priceRuleRepository.updatePrice(existingRule.id, newPrice);
    } else {
      try {
        appliedRule = await priceRuleRepository.create({
          serviceId,
          targetType,
          targetId,
          price: newPrice,
          active: true,
        });
      } catch (err) {
        if (err && err.code === "UNIQUE_PRICE_RULE_VIOLATION") {
          throw new DuplicatePriceRuleError(serviceId, targetType, targetId);
        }
        throw err;
      }
    }

    await eventPublisher.publish("ServicioActualizado", { service, appliedRule });

    return { service, appliedRule };
  };
}

module.exports = { createChangeServicePriceUseCase };
