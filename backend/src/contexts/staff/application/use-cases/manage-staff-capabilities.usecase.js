const { diffCapabilities } = require("../../domain/rules/capability-diff.rules");
const {
  StaffNotFoundError,
  ReferencedServiceNotFoundError,
  DuplicateStaffCapabilityError,
} = require("../../domain/errors");

/**
 * ManageStaffCapabilitiesUseCase — Administración.
 * Implementa "Administrar Capacidades del Staff". Recibe el conjunto
 * completo deseado y determina internamente qué se agrega y qué se retira.
 * Las capacidades representan aptitud profesional, nunca disponibilidad.
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/staff-capability-repository.port").StaffCapabilityRepositoryPort} deps.staffCapabilityRepository
 * @param {import("../ports/service-existence-reader.port").ServiceExistenceReaderPort} deps.serviceExistenceReader
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createManageStaffCapabilitiesUseCase({
  staffRepository,
  staffCapabilityRepository,
  serviceExistenceReader,
  eventPublisher,
}) {
  return async function execute({ staffId, serviceIds }) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) {
      throw new StaffNotFoundError(staffId);
    }

    for (const serviceId of serviceIds) {
      const exists = await serviceExistenceReader.exists(serviceId);
      if (!exists) {
        throw new ReferencedServiceNotFoundError(serviceId);
      }
    }

    const currentCapabilities = await staffCapabilityRepository.listActiveByStaff(staffId);
    const currentServiceIds = currentCapabilities.map((c) => c.serviceId);
    const { toAdd, toRemove } = diffCapabilities(currentServiceIds, serviceIds);

    for (const serviceId of toAdd) {
      try {
        await staffCapabilityRepository.create({ staffId, serviceId, active: true });
      } catch (err) {
        if (err && err.code === "UNIQUE_STAFF_CAPABILITY_VIOLATION") {
          throw new DuplicateStaffCapabilityError(staffId, serviceId);
        }
        throw err;
      }
      await eventPublisher.publish("CapacidadAsignada", { staffId, serviceId, tenantId: staff.tenantId });
    }
    for (const serviceId of toRemove) {
      await staffCapabilityRepository.revoke(staffId, serviceId);
      await eventPublisher.publish("CapacidadRevocada", { staffId, serviceId, tenantId: staff.tenantId });
    }

    const capabilities = await staffCapabilityRepository.listActiveByStaff(staffId);

    return { capabilities, added: toAdd, removed: toRemove };
  };
}

module.exports = { createManageStaffCapabilitiesUseCase };
