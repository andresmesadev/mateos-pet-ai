const { StaffNotFoundError, StaffAlreadyActiveError } = require("../../domain/errors");

/**
 * ReactivateStaffUseCase — Administración.
 * Implementa "Reactivar Staff". No escribe sobre StaffCapability: la
 * restauración de capacidades es un efecto emergente del filtro de
 * actividad (staff-modelo-persistencia.md, sección 5), no una operación
 * de datos. Tampoco restaura disponibilidad — es operativa, no profesional.
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/staff-capability-repository.port").StaffCapabilityRepositoryPort} deps.staffCapabilityRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createReactivateStaffUseCase({ staffRepository, staffCapabilityRepository, eventPublisher }) {
  return async function execute({ staffId, tenantId }) {
    const staff = await staffRepository.findById(staffId);
    if (!staff || (tenantId && staff.tenantId !== tenantId)) {
      throw new StaffNotFoundError(staffId);
    }
    if (staff.active) {
      throw new StaffAlreadyActiveError(staffId);
    }

    const updated = await staffRepository.update(staffId, { active: true });
    const restoredCapabilities = await staffCapabilityRepository.listActiveByStaff(staffId);

    await eventPublisher.publish("StaffReactivado", { staff: updated });

    return { staff: updated, restoredCapabilities };
  };
}

module.exports = { createReactivateStaffUseCase };
