const { isCategoryEnabled } = require("../../domain/rules/service-category.rules");
const { validateReservationDuration } = require("../../domain/rules/service-attributes.rules");
const {
  ServiceNotFoundError,
  ServiceCategoryNotEnabledError,
  InvalidServiceAttributesError,
} = require("../../domain/errors");

/**
 * UpdateServiceUseCase — Administración.
 * Implementa "Actualizar Servicio". El precio NO se gestiona aquí
 * (ver ChangeServicePriceUseCase) — es una decisión deliberada del contrato
 * funcional: el precio es una decisión financiera, no un atributo descriptivo.
 *
 * @param {Object} deps
 * @param {import("../ports/service-repository.port").ServiceRepositoryPort} deps.serviceRepository
 * @param {import("../ports/service-category-reader.port").ServiceCategoryReaderPort} deps.serviceCategoryReader
 * @param {import("../ports/business-config-reader.port").BusinessConfigReaderPort} deps.businessConfigReader
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createUpdateServiceUseCase({
  serviceRepository,
  serviceCategoryReader,
  businessConfigReader,
  eventPublisher,
}) {
  return async function execute({ tenantId, serviceId, name, categoryId, duration, requiresAppointment }) {
    const service = await serviceRepository.findById(serviceId);
    if (!service) {
      throw new ServiceNotFoundError(serviceId);
    }

    if (duration !== undefined || requiresAppointment !== undefined) validateReservationDuration(
      duration === undefined ? service.duration : duration,
      requiresAppointment === undefined ? service.requiresAppointment !== false : requiresAppointment,
    );

    if (categoryId && categoryId !== service.categoryId) {
      const category = await serviceCategoryReader.findById(categoryId);
      if (!category || !category.active) {
        throw new ServiceCategoryNotEnabledError(categoryId);
      }
      const activeModules = await businessConfigReader.getActiveModules(tenantId);
      if (!isCategoryEnabled(category.name, activeModules)) {
        throw new ServiceCategoryNotEnabledError(categoryId);
      }
    }

    const updated = await serviceRepository.update(serviceId, {
      ...(name !== undefined ? { name } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(requiresAppointment !== undefined ? { requiresAppointment } : {}),
    });

    await eventPublisher.publish("ServicioActualizado", { service: updated });

    return { service: updated };
  };
}

module.exports = { createUpdateServiceUseCase };
