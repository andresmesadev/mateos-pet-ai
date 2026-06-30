const { isCategoryEnabled } = require("../../domain/rules/service-category.rules");
const {
  ServiceCategoryNotEnabledError,
  DuplicateServiceNameError,
  InvalidServiceAttributesError,
} = require("../../domain/errors");

/**
 * CreateServiceUseCase — Administración.
 * Implementa "Crear Servicio" (sistema-operativo-servicios.md).
 *
 * @param {Object} deps
 * @param {import("../ports/service-repository.port").ServiceRepositoryPort} deps.serviceRepository
 * @param {import("../ports/service-category-reader.port").ServiceCategoryReaderPort} deps.serviceCategoryReader
 * @param {import("../ports/business-config-reader.port").BusinessConfigReaderPort} deps.businessConfigReader
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createCreateServiceUseCase({
  serviceRepository,
  serviceCategoryReader,
  businessConfigReader,
  eventPublisher,
}) {
  return async function execute({ tenantId, name, categoryId, duration, basePrice }) {
    if (!duration || duration <= 0) {
      throw new InvalidServiceAttributesError("La duración estándar debe ser mayor a cero.");
    }
    if (basePrice == null || Number(basePrice) < 0) {
      throw new InvalidServiceAttributesError("El precio base no puede ser nulo ni negativo.");
    }

    const category = await serviceCategoryReader.findById(categoryId);
    if (!category || !category.active) {
      throw new ServiceCategoryNotEnabledError(categoryId);
    }

    const activeModules = await businessConfigReader.getActiveModules(tenantId);
    if (!isCategoryEnabled(category.name, activeModules)) {
      throw new ServiceCategoryNotEnabledError(categoryId);
    }

    const existing = await serviceRepository.findActiveByNameAndCategory(tenantId, categoryId, name);
    if (existing) {
      throw new DuplicateServiceNameError(name, categoryId);
    }

    const service = await serviceRepository.create({
      tenantId,
      name,
      categoryId,
      duration,
      basePrice,
      active: true,
    });

    await eventPublisher.publish("ServicioCreado", { service });

    return { service };
  };
}

module.exports = { createCreateServiceUseCase };
