/**
 * Motor de disponibilidad para Mateos Pet.
 * Reglas de día hábil, horario y slots. Calendario en America/Bogota.
 */

const {
  TIMEZONE,
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

/** Duración típica consulta (minutos): informativa para logs/comentarios; slots mock son por hora. */
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
      `[availability] isWithinBusinessHours vet ${h}h → ${valid} (11am–5pm, inicio hasta 16h; duración mock ~${VET_SLOT_DURATION_MINUTES} min)`
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

/** @typedef {{ date: string, hour: number, serviceType?: string }} MockAppointment */

const groomingBookedHours = (existingAppointments, dateKey) => {
  const set = new Set();
  for (const a of existingAppointments || []) {
    const type = (a.serviceType || "").toLowerCase();
    if (type !== SERVICE_TYPES.GROOMING) continue;
    if (a.date === dateKey) {
      set.add(Number(a.hour));
    }
  }
  return set;
};

const vetBookedHours = (existingAppointments, dateKey) => {
  const set = new Set();
  for (const a of existingAppointments || []) {
    const type = (a.serviceType || "").toLowerCase();
    if (type !== SERVICE_TYPES.VET) continue;
    if (a.date === dateKey) {
      set.add(Number(a.hour));
    }
  }
  return set;
};

const getNextAvailableGroomingSlot = (existingAppointments, options = {}) => {
  let cursor =
    toDateKey(options.referenceDate ?? new Date()) || toDateKey(new Date());
  const maxSkips = 366;
  let skipped = 0;

  console.log(
    `[availability] getNextAvailableGroomingSlot: buscando desde ${cursor} (${TIMEZONE})`
  );

  while (skipped < maxSkips) {
    if (!isBusinessDay(cursor)) {
      cursor = addOneDay(cursor);
      skipped += 1;
      continue;
    }

    const booked = groomingBookedHours(existingAppointments, cursor);

    for (let h = GROOMING_FIRST_HOUR; h <= GROOMING_LAST_START_HOUR; h += 1) {
      if (!booked.has(h)) {
        const slot = { date: cursor, hour: h };
        console.log(
          "[availability] siguiente slot grooming:",
          JSON.stringify(slot)
        );
        return slot;
      }
    }

    cursor = addOneDay(cursor);
    skipped += 1;
  }

  console.log("[availability] getNextAvailableGroomingSlot: sin hueco en ventana");
  return null;
};

const suggestVetAlternativeSlots = (
  requestedHour,
  existingAppointments,
  explicitDateKey
) => {
  const hr = Number(requestedHour);
  if (!Number.isFinite(hr)) {
    console.log("[availability] suggestVetAlternativeSlots: hora inválida");
    return [];
  }

  let dateKey =
    explicitDateKey ||
    existingAppointments?.find((a) => a.date)?.date ||
    toDateKey(new Date());

  if (!dateKey || !isBusinessDay(dateKey)) {
    console.log(
      `[availability] suggestVetAlternativeSlots: ${String(dateKey)} no es día hábil; buscando próximo hábil`
    );
    let c = dateKey || toDateKey(new Date());
    for (let i = 0; i < 14; i += 1) {
      if (isBusinessDay(c)) {
        dateKey = c;
        break;
      }
      c = addOneDay(c);
    }
  }

  const booked = vetBookedHours(existingAppointments, dateKey);

  if (!booked.has(hr)) {
    console.log(
      `[availability] vet ${hr}h el ${dateKey}: libre → sin alternativas`
    );
    return [];
  }

  const candidates = [];
  for (let h = VET_START_HOUR; h < VET_END_HOUR_EXCLUSIVE; h += 1) {
    if (h === hr) continue;
    if (booked.has(h)) continue;
    if (!isWithinBusinessHours(SERVICE_TYPES.VET, h)) continue;
    candidates.push(h);
  }

  const suggestion = candidates.slice(0, 3);
  console.log(
    `[availability] vet ${hr}h ocupado el ${dateKey}; alternativas (max 3):`,
    suggestion
  );
  return suggestion;
};

module.exports = {
  TIMEZONE,
  isBusinessDay,
  isWithinBusinessHours,
  getNextAvailableGroomingSlot,
  suggestVetAlternativeSlots,
  toDateKey,
  addOneDay,
  SERVICE_TYPES,
  vetBookedHours,
  groomingBookedHours,
};
