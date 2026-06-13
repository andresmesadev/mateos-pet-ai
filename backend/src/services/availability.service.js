/**
 * Motor de disponibilidad para Mateos Pet.
 * Reglas de día hábil, horario y slots. Calendario en America/Bogota.
 */

const {
  toDateKey,
  addOneDay,
  getDayOfWeekFromKey,
} = require("../lib/timezone");
const {
  isColombianHoliday,
  getHolidayName,
} = require("../lib/colombianHolidays");

/** Tipos de servicio reconocidos por este servicio. */
const SERVICE_TYPES = {
  VET: "vet",
  GROOMING: "grooming",
};

/** Horas de inicio de consulta veterinaria (entero 0–23). Incluye 11; excluye cierre 17h (último inicio razonable 16h). */
const VET_START_HOUR = 11;
const VET_END_HOUR_EXCLUSIVE = 17;

/** Duración típica consulta (minutos): informativa para logs. */
const VET_SLOT_DURATION_MINUTES = 45;

/** Peluquería: slots cada 1 hora desde las 11. Último inicio antes del cierre. */
const GROOMING_FIRST_HOUR = 11;
const GROOMING_LAST_START_HOUR = 16;

/**
 * Día hábil: no domingo, no festivo Colombia (calendario Bogotá).
 * @param {Date|string} date
 * @returns {boolean}
 */
const isBusinessDay = (date) => {
  const key = toDateKey(date);
  if (!key) {
    console.log("[availability] isBusinessDay: fecha inválida → false");
    return false;
  }

  const dayOfWeek = getDayOfWeekFromKey(key);

  if (dayOfWeek === 0) {
    console.log(`[availability] isBusinessDay ${key}: domingo → false`);
    return false;
  }

  if (isColombianHoliday(key)) {
    const holidayName = getHolidayName(key);
    console.log(
      `[availability] isBusinessDay ${key}: festivo Colombia (${holidayName}) → false`
    );
    return false;
  }

  return true;
};

/**
 * La hora cae dentro del horario del tipo de servicio (hora entera, Bogotá).
 * @param {"vet"|"grooming"} serviceType
 * @param {number} hour Entero 0–23
 * @returns {boolean}
 */
const isWithinBusinessHours = (serviceType, hour) => {
  const h = Number(hour);
  if (!Number.isFinite(h) || h < 0 || h > 23) {
    console.log(
      `[availability] isWithinBusinessHours: hora inválida (${hour}) → false`
    );
    return false;
  }

  if (serviceType === SERVICE_TYPES.VET) {
    const valid = h >= VET_START_HOUR && h < VET_END_HOUR_EXCLUSIVE;
    console.log(
      `[availability] isWithinBusinessHours vet ${h}h → ${valid} (11am–5pm, inicio hasta 16h; duración ~${VET_SLOT_DURATION_MINUTES} min)`
    );
    return valid;
  }

  if (serviceType === SERVICE_TYPES.GROOMING) {
    const valid =
      h >= GROOMING_FIRST_HOUR && h <= GROOMING_LAST_START_HOUR;
    console.log(
      `[availability] isWithinBusinessHours grooming ${h}h → ${valid} (slots ${GROOMING_FIRST_HOUR}–${GROOMING_LAST_START_HOUR})`
    );
    return valid;
  }

  console.log(
    `[availability] isWithinBusinessHours: tipo desconocido "${serviceType}" → false`
  );
  return false;
};

module.exports = {
  isBusinessDay,
  isWithinBusinessHours,
  toDateKey,
  addOneDay,
  SERVICE_TYPES,
};
