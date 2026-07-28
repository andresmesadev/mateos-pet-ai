const { isStaffAvailable } = require("../../domain/rules/availability-resolution.rules");
const { ReferencedServiceNotFoundError } = require("../../domain/errors");

function toHHmm(date) {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

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
}) {
  return async function execute({ serviceId, rangeStart, rangeEnd, tenantId }) {
    const exists = await serviceExistenceReader.exists(serviceId);
    if (!exists) {
      throw new ReferencedServiceNotFoundError(serviceId);
    }

    const capableStaff = await staffCapabilityRepository.listActiveByService(serviceId);

    const start = new Date(rangeStart);
    const weekday = start.getUTCDay();
    const startTime = toHHmm(start);
    const endTime = toHHmm(new Date(rangeEnd));

    const availableStaff = [];
    for (const capability of capableStaff) {
      const staff = await staffRepository.findById(capability.staffId);
      if (!staff || !staff.active) continue;
      if (tenantId && staff.tenantId !== tenantId) continue;

      const availabilityRows = await availabilityRepository.listByStaff(staff.id);
      if (isStaffAvailable(availabilityRows, { weekday, startTime, endTime, rangeStart, rangeEnd })) {
        availableStaff.push(staff);
      }
    }

    return { availableStaff };
  };
}

module.exports = { createResolveStaffAvailabilityUseCase };
