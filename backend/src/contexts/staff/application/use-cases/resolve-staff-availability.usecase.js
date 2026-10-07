const { staffWindowReason } = require("../../domain/rules/staff-window.rules");
const { ReferencedServiceNotFoundError } = require("../../domain/errors");
const { compatibleRole, canProvideService } = require('../../domain/rules/service-scope.rules');

/**
 * ResolveStaffAvailabilityUseCase — Resolución.
 * Implementa "Resolver Disponibilidad del Staff". Operación de lectura pura:
 * combina capacidad (¿puede prestar el servicio?) y disponibilidad
 * (¿está libre en ese rango?).
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/staff-capability-repository.port").StaffCapabilityRepositoryPort} deps.staffCapabilityRepository
 * @param {import("../ports/availability-repository.port").AvailabilityRepositoryPort} deps.availabilityRepository
 * @param {import("../ports/service-existence-reader.port").ServiceExistenceReaderPort} deps.serviceExistenceReader
 */
function createResolveStaffAvailabilityUseCase({
  staffRepository,
  staffCapabilityRepository,
  availabilityRepository,
  serviceExistenceReader,
  serviceCategoryReader,
}) {
  return async function execute({ serviceId, rangeStart, rangeEnd, tenantId, timeZone = 'UTC' }) {
    const exists = await serviceExistenceReader.exists(serviceId);
    if (!exists) {
      throw new ReferencedServiceNotFoundError(serviceId);
    }

    const capableStaff = await staffCapabilityRepository.listActiveByService(serviceId);
    const candidates = new Set(capableStaff.map(c => c.staffId));
    const category = serviceCategoryReader ? await serviceCategoryReader.getCategoryForService(serviceId) : null;
    if (category && tenantId) {
      const roster = await staffRepository.listActive({ tenantId });
      for (const staff of roster) if (staff.serviceScope === 'role' && compatibleRole(staff, category.name)) candidates.add(staff.id);
    }

    const availableStaff = [];
    for (const staffId of candidates) {
      const staff = await staffRepository.findById(staffId);
      if (!staff || !staff.active) continue;
      if (tenantId && staff.tenantId !== tenantId) continue;
      if (category && !compatibleRole(staff, category.name)) continue;
      if (!canProvideService(staff, capableStaff.filter(c=>c.staffId===staff.id), serviceId)) continue;

      const availabilityRows = await availabilityRepository.listByStaff(staff.id);
      if (!staffWindowReason(staff, availabilityRows, rangeStart, rangeEnd, timeZone)) {
        availableStaff.push(staff);
      }
    }

    return { availableStaff };
  };
}

module.exports = { createResolveStaffAvailabilityUseCase };
