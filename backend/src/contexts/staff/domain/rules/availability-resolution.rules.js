/**
 * Domain rule — resolución y validación de disponibilidad del contexto Staff.
 *
 * Funciones puras: no conocen Prisma, no conocen HTTP, no consultan nada por
 * su cuenta. Reciben ya cargadas las filas de StaffAvailability relevantes.
 *
 * Convención de día de la semana: 0 = domingo ... 6 = sábado, igual que
 * getUTCDay() de JavaScript (consistente con el campo legado Staff.availability,
 * ver ADR 003).
 */

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * ¿El horario base de un staff cubre el rango [startTime, endTime) de un día determinado?
 * @param {Array} baseScheduleRows - filas StaffAvailability con type = "base_schedule"
 */
function isWithinBaseSchedule(baseScheduleRows, weekday, startTime, endTime) {
  const day = baseScheduleRows.find((row) => row.weekday === weekday);
  if (!day) return false;
  return timeToMinutes(day.startTime) <= timeToMinutes(startTime) && timeToMinutes(endTime) <= timeToMinutes(day.endTime);
}

/**
 * ¿Alguna ausencia (programada o imprevista) se superpone con [rangeStart, rangeEnd)?
 * @param {Array} absenceRows - filas StaffAvailability con type = "planned_absence" | "unplanned_absence"
 */
function hasAbsenceOverlap(absenceRows, rangeStart, rangeEnd) {
  const start = new Date(rangeStart).getTime();
  const end = new Date(rangeEnd).getTime();
  return absenceRows.some((row) => {
    const absenceStart = new Date(row.startAt).getTime();
    const absenceEnd = new Date(row.endAt).getTime();
    return start < absenceEnd && absenceStart < end;
  });
}

/**
 * ¿Está el staff disponible para el rango solicitado? Combina horario base y ausencias.
 * @param {Array} availabilityRows - todas las filas StaffAvailability del staff
 */
function isStaffAvailable(availabilityRows, { weekday, startTime, endTime, rangeStart, rangeEnd }) {
  const baseScheduleRows = availabilityRows.filter((row) => row.type === "base_schedule");
  const absenceRows = availabilityRows.filter((row) => row.type !== "base_schedule");

  if (!isWithinBaseSchedule(baseScheduleRows, weekday, startTime, endTime)) return false;
  if (hasAbsenceOverlap(absenceRows, rangeStart, rangeEnd)) return false;
  return true;
}

/**
 * Excepción documentada al Principio Permanente del Esquema Físico
 * (Decisión Arquitectónica Diferida #6, sistema-operativo-staff.md): el
 * solapamiento de horario base se protege únicamente aquí, en la aplicación,
 * no con una restricción de base de datos.
 *
 * @param {Array} existingBaseScheduleRows - filas base_schedule ya existentes del staff
 */
function hasBaseScheduleOverlap(existingBaseScheduleRows, weekday, startTime, endTime) {
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);
  return existingBaseScheduleRows
    .filter((row) => row.weekday === weekday)
    .some((row) => newStart < timeToMinutes(row.endTime) && timeToMinutes(row.startTime) < newEnd);
}

module.exports = { isWithinBaseSchedule, hasAbsenceOverlap, isStaffAvailable, hasBaseScheduleOverlap };
