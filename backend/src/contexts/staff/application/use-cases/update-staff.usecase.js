const { StaffNotFoundError, InvalidStaffAttributesError } = require("../../domain/errors");

const VALID_ROLES = ["vet", "groomer", "admin"];

/**
 * UpdateStaffUseCase — Administración.
 * Implementa "Actualizar Staff". Cambiar el rol o generatesCommission nunca
 * reinterpreta Commission/Settlement ya registrados — esos montos quedan
 * congelados en sus propias filas, ajenos al estado actual del staff.
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createUpdateStaffUseCase({ staffRepository, eventPublisher }) {
  return async function execute({ staffId, name, role, phone, email, generatesCommission, tenantId }) {
    const staff = await staffRepository.findById(staffId);
    if (!staff || (tenantId && staff.tenantId !== tenantId)) {
      throw new StaffNotFoundError(staffId);
    }
    if (role !== undefined && !VALID_ROLES.includes(role)) {
      throw new InvalidStaffAttributesError(`role debe ser uno de: ${VALID_ROLES.join(", ")}`);
    }
    if (name !== undefined && !name.trim()) {
      throw new InvalidStaffAttributesError("El nombre no puede quedar vacío.");
    }

    const updated = await staffRepository.update(staffId, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(generatesCommission !== undefined ? { generatesCommission } : {}),
    });

    await eventPublisher.publish("StaffActualizado", { staff: updated });

    return { staff: updated };
  };
}

module.exports = { createUpdateStaffUseCase };
