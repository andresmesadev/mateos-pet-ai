const { resolveServicePrice } = require("../../domain/rules/price-resolution.rules");
const { ServiceNotFoundError, ServiceInactiveError } = require("../../domain/errors");

/**
 * ResolveServicePriceUseCase — Resolución.
 * Implementa "Resolver Precio del Servicio". Operación de lectura pura:
 * no modifica estado, no produce eventos de dominio.
 *
 * @param {Object} deps
 * @param {import("../ports/service-repository.port").ServiceRepositoryPort} deps.serviceRepository
 * @param {import("../ports/price-rule-repository.port").PriceRuleRepositoryPort} deps.priceRuleRepository
 * @param {import("../ports/target-existence-reader.port").TargetExistenceReaderPort} deps.targetExistenceReader
 */
function createResolveServicePriceUseCase({ serviceRepository, priceRuleRepository, targetExistenceReader }) {
  return async function execute({ serviceId, petId = null, clientId = null }) {
    const service = await serviceRepository.findById(serviceId);
    if (!service) {
      throw new ServiceNotFoundError(serviceId);
    }
    if (!service.active) {
      throw new ServiceInactiveError(serviceId);
    }

    const priceRules = await priceRuleRepository.listByService(serviceId);

    let breedId = null;
    let size = null;
    if (petId) {
      const petAttributes = await targetExistenceReader.getPetAttributes(petId);
      if (petAttributes) {
        breedId = petAttributes.breedId;
        size = petAttributes.size;
      }
    }

    const { finalPrice, source, trace } = resolveServicePrice({
      priceRules,
      basePrice: service.basePrice,
      petId,
      clientId,
      breedId,
      size,
    });

    return { finalPrice, source, trace };
  };
}

module.exports = { createResolveServicePriceUseCase };
