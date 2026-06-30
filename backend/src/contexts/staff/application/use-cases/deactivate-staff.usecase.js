const { StaffNotFoundError, StaffAlreadyInactiveError } = require("../../domain/errors");

/**
 * DeactivateStaffUseCase — Administración.
 * Implementa "Desactivar Staff". Nunca elimina: solo marca inactivo.
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createDeactivateStaffUseCase({ staffRepository, eventPublisher }) {
  return async function execute({ staffId }) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) {
      throw new StaffNotFoundError(staffId);
    }
    if (!staff.active) {
      throw new StaffAlreadyInactiveError(staffId);
    }

    const updated = await staffRepository.update(staffId, { active: false });

    await eventPublisher.publish("StaffDesactivado", { staff: updated });

    return { staff: updated };
  };
}

module.exports = { createDeactivateStaffUseCase };
