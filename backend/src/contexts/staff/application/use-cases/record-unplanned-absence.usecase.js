const { StaffNotFoundError, InvalidAvailabilityRangeError } = require("../../domain/errors");

/**
 * RecordUnplannedAbsenceUseCase — Operación.
 * Implementa "Registrar Ausencia Imprevista". Tiene peso operativo
 * inmediato, distinto de la planificación de Actualizar Disponibilidad.
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/availability-repository.port").AvailabilityRepositoryPort} deps.availabilityRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createRecordUnplannedAbsenceUseCase({ staffRepository, availabilityRepository, eventPublisher }) {
  return async function execute({ staffId, startAt, endAt, reason }) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) {
      throw new StaffNotFoundError(staffId);
    }
    if (!startAt || !endAt || new Date(startAt) >= new Date(endAt)) {
      throw new InvalidAvailabilityRangeError("La ausencia imprevista requiere startAt y endAt, con startAt < endAt.");
    }

    const availability = await availabilityRepository.create({
      staffId,
      type: "unplanned_absence",
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      reason: reason ?? null,
    });

    await eventPublisher.publish("DisponibilidadActualizada", { staffId, availability, origin: "unplanned", tenantId: staff.tenantId });

    return { availability };
  };
}

module.exports = { createRecordUnplannedAbsenceUseCase };
