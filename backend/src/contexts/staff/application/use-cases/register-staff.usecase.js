const { InvalidStaffAttributesError } = require("../../domain/errors");
const { validAccessPermissions } = require('../../domain/rules/staff-access.rules');

const VALID_ROLES = ["vet", "groomer", "receptionist", "admin"];
const DEFAULT_GENERATES_COMMISSION_BY_ROLE = { vet: true, groomer: true, receptionist: false, admin: false };

/**
 * RegisterStaffUseCase — Administración.
 * Implementa "Registrar Staff" (sistema-operativo-staff.md).
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createRegisterStaffUseCase({ staffRepository, eventPublisher }) {
  return async function execute({ tenantId, name, role, phone, email, generatesCommission, accessPermissions = [] }) {
    if (!name || !name.trim()) {
      throw new InvalidStaffAttributesError("El nombre es obligatorio.");
    }
    if (!VALID_ROLES.includes(role)) {
      throw new InvalidStaffAttributesError(`role debe ser uno de: ${VALID_ROLES.join(", ")}`);
    }
    if (!validAccessPermissions(accessPermissions)) {
      throw new InvalidStaffAttributesError('Permisos inválidos.');
    }

    const staff = await staffRepository.create({
      tenantId,
      name: name.trim(),
      role,
      phone: phone ?? null,
      email: email ?? null,
      active: true,
      accessPermissions: [...new Set(accessPermissions)],
      generatesCommission:
        generatesCommission !== undefined ? generatesCommission : DEFAULT_GENERATES_COMMISSION_BY_ROLE[role],
    });

    await eventPublisher.publish("StaffRegistrado", { staff });

    return { staff };
  };
}

module.exports = { createRegisterStaffUseCase };
