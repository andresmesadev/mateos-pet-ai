const { InvalidStaffAttributesError } = require("../../domain/errors");

const VALID_ROLES = ["vet", "groomer", "admin"];
const DEFAULT_GENERATES_COMMISSION_BY_ROLE = { vet: true, groomer: true, admin: false };

/**
 * RegisterStaffUseCase — Administración.
 * Implementa "Registrar Staff" (sistema-operativo-staff.md).
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createRegisterStaffUseCase({ staffRepository, eventPublisher }) {
  return async function execute({ tenantId, name, role, phone, email, generatesCommission }) {
    if (!name || !name.trim()) {
      throw new InvalidStaffAttributesError("El nombre es obligatorio.");
    }
    if (!VALID_ROLES.includes(role)) {
      throw new InvalidStaffAttributesError(`role debe ser uno de: ${VALID_ROLES.join(", ")}`);
    }

    const staff = await staffRepository.create({
      tenantId,
      name: name.trim(),
      role,
      phone: phone ?? null,
      email: email ?? null,
      active: true,
      generatesCommission:
        generatesCommission !== undefined ? generatesCommission : DEFAULT_GENERATES_COMMISSION_BY_ROLE[role],
    });

    await eventPublisher.publish("StaffRegistrado", { staff });

    return { staff };
  };
}

module.exports = { createRegisterStaffUseCase };
