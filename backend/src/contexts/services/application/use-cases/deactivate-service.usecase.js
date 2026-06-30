const { ServiceNotFoundError, ServiceAlreadyInactiveError } = require("../../domain/errors");

/**
 * DeactivateServiceUseCase — Administración.
 * Implementa "Desactivar Servicio". Nunca elimina: solo marca inactivo.
 *
 * @param {Object} deps
 * @param {import("../ports/service-repository.port").ServiceRepositoryPort} deps.serviceRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createDeactivateServiceUseCase({ serviceRepository, eventPublisher }) {
  return async function execute({ serviceId }) {
    const service = await serviceRepository.findById(serviceId);
    if (!service) {
      throw new ServiceNotFoundError(serviceId);
    }
    if (!service.active) {
      throw new ServiceAlreadyInactiveError(serviceId);
    }

    const updated = await serviceRepository.update(serviceId, { active: false });

    await eventPublisher.publish("ServicioDesactivado", { service: updated });

    return { service: updated };
  };
}

module.exports = { createDeactivateServiceUseCase };
