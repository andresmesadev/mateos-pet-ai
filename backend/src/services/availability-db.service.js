/**
 * Disponibilidad basada en PostgreSQL (Appointment).
 * Preparado para sincronización futura con Google Calendar (eventos externos).
 */

const prisma = require("../lib/prisma");
const {
  toDateKey,
  getHourInTimezone,
  dayBoundsInTimezone,
  zonedDateTimeToUtc,
} = require("../lib/timezone");
const {
  isBusinessDay,
  isWithinBusinessHours,
  addOneDay,
  SERVICE_TYPES,
} = require("./availability.service");

const GROOMING_FIRST_HOUR = 11;
const GROOMING_LAST_START_HOUR = 16;
const VET_START_HOUR = 11;
const VET_END_HOUR_EXCLUSIVE = 17;

const MAX_GROOMING_SEARCH_DAYS = 30;
const MAX_VET_SUGGESTIONS = 3;

/** Tipos que comparten agenda veterinaria (misma hora). */
const VET_BUCKET_TYPES = new Set(["vet", "general_appointment", "medication"]);

/** Sub-servicios de grooming — todos comparten la misma agenda. */
const GROOMING_SUB_SERVICES = new Set([
  "baño básico",
  "baño + corte",
  "baño medicado",
  "baño antipulgas",
  "spa canino/felino",
  "deslanado",
  "colorimetría",
]);

const normalizeServiceType = (serviceType) => {
  const type = String(serviceType || "").trim().toLowerCase();
  if (type === "bath_grooming" || type === "grooming" || GROOMING_SUB_SERVICES.has(type))
    return SERVICE_TYPES.GROOMING;
  if (type === "veterinary_consultation") return SERVICE_TYPES.VET;
  return type;
};

const dayBounds = (dateKey) => dayBoundsInTimezone(dateKey);

const appointmentToSlot = (row) => {
  const date = row.date instanceof Date ? row.date : new Date(row.date);
  return {
    id: row.id,
    userId: row.userId,
    petName: row.petName,
    petType: row.petType,
    serviceType: normalizeServiceType(row.serviceType),
    status: row.status,
    dateKey: toDateKey(date),
    hour: getHourInTimezone(date),
    date,
  };
};

/**
 * Citas activas de un día (YYYY-MM-DD).
 */
const getAppointmentsByDate = async (dateKey) => {
  const key = toDateKey(dateKey);

  if (!key) {
    throw new Error("dateKey must be YYYY-MM-DD");
  }

  try {
    console.log("[AvailabilityDB] Loading appointments for", key);

    const { start, end } = dayBounds(key);

    const rows = await prisma.appointment.findMany({
      where: {
        date: { gte: start, lte: end },
        status: { not: "cancelled" },
      },
      orderBy: { date: "asc" },
    });

    return rows.map(appointmentToSlot);
  } catch (error) {
    console.error("[AvailabilityDB] getAppointmentsByDate error:", error.message);
    throw error;
  }
};

const getBookedHoursForDate = async (dateKey, serviceType) => {
  const type = normalizeServiceType(serviceType);
  const appointments = await getAppointmentsByDate(dateKey);
  const hours = new Set();

  for (const appt of appointments) {
    if (type === SERVICE_TYPES.GROOMING) {
      if (appt.serviceType === SERVICE_TYPES.GROOMING) {
        hours.add(appt.hour);
      }
      continue;
    }

    if (type === SERVICE_TYPES.VET) {
      if (VET_BUCKET_TYPES.has(appt.serviceType)) {
        hours.add(appt.hour);
      }
    }
  }

  return hours;
};

/**
 * Verifica slot libre en DB para fecha/hora/tipo.
 */
const isSlotAvailable = async ({ dateKey, hour, serviceType }) => {
  const key = toDateKey(dateKey);
  const h = Number(hour);
  const type = normalizeServiceType(serviceType);

  if (!key || !Number.isFinite(h)) {
    return false;
  }

  try {
    if (!isBusinessDay(key)) {
      console.log("[AvailabilityDB] Slot occupied (non-business day):", key);
      return false;
    }

    if (!isWithinBusinessHours(type, h)) {
      console.log("[AvailabilityDB] Slot occupied (outside hours):", h, type);
      return false;
    }

    const booked = await getBookedHoursForDate(key, type);

    if (booked.has(h)) {
      console.log("[AvailabilityDB] Slot occupied:", key, h, type);
      return false;
    }

    // Grooming: regla de orden consecutivo — no se puede saltar un slot
    if (type === SERVICE_TYPES.GROOMING && h > GROOMING_FIRST_HOUR) {
      for (let prev = GROOMING_FIRST_HOUR; prev < h; prev++) {
        if (!booked.has(prev)) {
          console.log(`[AvailabilityDB] Grooming slot ${h}h bloqueado — slot ${prev}h sin ocupar (regla consecutiva)`);
          return false;
        }
      }
    }

    console.log("[AvailabilityDB] Slot available:", key, h, type);
    return true;
  } catch (error) {
    console.error("[AvailabilityDB] isSlotAvailable error:", error.message);
    return false;
  }
};

const GROOMING_FUTURE_BUFFER_MS = 30 * 60 * 1000;

/**
 * Próximo turno grooming libre (1h) en los próximos 30 días hábiles.
 * Solo retorna slots al menos 30 minutos en el futuro (hora Bogotá).
 * @param {{ referenceDate?: Date|string }} [options]
 * @returns {Promise<{ date: string, hour: number }|null>}
 */
const findNextAvailableGroomingSlot = async (options = {}) => {
  const referenceDate =
    options.referenceDate instanceof Date
      ? options.referenceDate
      : new Date(options.referenceDate ?? Date.now());

  let cursor = toDateKey(referenceDate) || toDateKey(new Date());
  const todayKey = cursor;
  const cutoffTime = new Date(referenceDate.getTime() + GROOMING_FUTURE_BUFFER_MS);

  try {
    for (let day = 0; day < MAX_GROOMING_SEARCH_DAYS; day += 1) {
      if (!isBusinessDay(cursor)) {
        cursor = addOneDay(cursor);
        continue;
      }

      for (
        let h = GROOMING_FIRST_HOUR;
        h <= GROOMING_LAST_START_HOUR;
        h += 1
      ) {
        // Skip slots already past (only relevant for today)
        if (cursor === todayKey) {
          const slotUtc = zonedDateTimeToUtc(cursor, h);
          if (slotUtc < cutoffTime) {
            console.log(
              `[AvailabilityDB] Skipping past grooming slot ${h}h on ${cursor}`
            );
            continue;
          }
        }

        const available = await isSlotAvailable({
          dateKey: cursor,
          hour: h,
          serviceType: SERVICE_TYPES.GROOMING,
        });

        if (available) {
          const slot = { date: cursor, hour: h };
          console.log(
            "[AvailabilityDB] Next grooming slot:",
            JSON.stringify(slot)
          );
          return slot;
        }
      }

      cursor = addOneDay(cursor);
    }

    console.log("[AvailabilityDB] No grooming slot in", MAX_GROOMING_SEARCH_DAYS, "days");
    return null;
  } catch (error) {
    console.error(
      "[AvailabilityDB] findNextAvailableGroomingSlot error:",
      error.message
    );
    return null;
  }
};

/**
 * Hasta 3 horas vet libres en un día (11am–5pm inicio).
 * @param {{ dateKey: string, requestedHour?: number, limit?: number }} params
 * @returns {Promise<{ dateKey: string, hours: number[] }>}
 */
const suggestAvailableVetSlots = async ({
  dateKey,
  requestedHour,
  limit = MAX_VET_SUGGESTIONS,
} = {}) => {
  let key = toDateKey(dateKey) || toDateKey(new Date());
  const max = Math.min(Math.max(Number(limit) || MAX_VET_SUGGESTIONS, 1), 10);
  const requested = Number(requestedHour);

  try {
    if (!key || !isBusinessDay(key)) {
      let cursor = key || toDateKey(new Date());
      for (let i = 0; i < 14; i += 1) {
        if (isBusinessDay(cursor)) {
          key = cursor;
          break;
        }
        cursor = addOneDay(cursor);
      }
    }

    const booked = await getBookedHoursForDate(key, SERVICE_TYPES.VET);
    const suggestions = [];

    for (let h = VET_START_HOUR; h < VET_END_HOUR_EXCLUSIVE; h += 1) {
      if (Number.isFinite(requested) && h === requested) {
        continue;
      }
      if (booked.has(h)) {
        continue;
      }
      if (!isWithinBusinessHours(SERVICE_TYPES.VET, h)) {
        continue;
      }
      suggestions.push(h);
      if (suggestions.length >= max) {
        break;
      }
    }

    console.log("[AvailabilityDB] Suggestions found:", suggestions.length, key);
    return { dateKey: key, hours: suggestions };
  } catch (error) {
    console.error("[AvailabilityDB] suggestAvailableVetSlots error:", error.message);
    return { dateKey: key || toDateKey(new Date()), hours: [] };
  }
};

/**
 * Citas del día en formato { date, hour, serviceType } para scheduling.
 */
const getSchedulingAppointments = async (dateKey) => {
  const list = await getAppointmentsByDate(dateKey);
  return list.map((a) => ({
    date: a.dateKey,
    hour: a.hour,
    serviceType: a.serviceType,
  }));
};

module.exports = {
  getAppointmentsByDate,
  isSlotAvailable,
  findNextAvailableGroomingSlot,
  suggestAvailableVetSlots,
  getSchedulingAppointments,
  MAX_GROOMING_SEARCH_DAYS,
};
