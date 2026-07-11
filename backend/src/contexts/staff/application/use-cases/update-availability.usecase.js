const { hasBaseScheduleOverlap } = require("../../domain/rules/availability-resolution.rules");
const { StaffNotFoundError, InvalidAvailabilityRangeError } = require("../../domain/errors");

/**
 * UpdateAvailabilityUseCase — Administración.
 * Implementa "Actualizar Disponibilidad": horario base y ausencias programadas.
 * Protege el solapamiento de horario base únicamente en esta capa —
 * excepción documentada (Decisión Arquitectónica Diferida #6).
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/availability-repository.port").AvailabilityRepositoryPort} deps.availabilityRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createUpdateAvailabilityUseCase({ staffRepository, availabilityRepository, eventPublisher }) {
  return async function execute({ staffId, type, schedule, range }) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) {
      throw new StaffNotFoundError(staffId);
    }

    let availability;

    if (type === "base_schedule") {
      const { weekday, startTime, endTime } = schedule || {};
      if (weekday == null || !startTime || !endTime || startTime >= endTime) {
        throw new InvalidAvailabilityRangeError("El horario base requiere weekday, startTime y endTime, con startTime < endTime.");
      }
      const existing = await availabilityRepository.listBaseScheduleByStaff(staffId);
      if (hasBaseScheduleOverlap(existing, weekday, startTime, endTime)) {
        throw new InvalidAvailabilityRangeError("La franja se superpone con un horario base ya existente para ese día.");
      }
      availability = await availabilityRepository.create({ staffId, type: "base_schedule", weekday, startTime, endTime });
    } else if (type === "planned_absence") {
      const { startAt, endAt, reason } = range || {};
      if (!startAt || !endAt || new Date(startAt) >= new Date(endAt)) {
        throw new InvalidAvailabilityRangeError("La ausencia programada requiere startAt y endAt, con startAt < endAt.");
      }
      availability = await availabilityRepository.create({
        staffId,
        type: "planned_absence",
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        reason: reason ?? null,
      });
    } else {
      throw new InvalidAvailabilityRangeError(`type "${type}" no es válido. Use "base_schedule" o "planned_absence".`);
    }

    await eventPublisher.publish("DisponibilidadActualizada", { staffId, availability, origin: "planned", tenantId: staff.tenantId });

    return { availability };
  };
}

module.exports = { createUpdateAvailabilityUseCase };
