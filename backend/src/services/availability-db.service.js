/**
 * Disponibilidad basada en PostgreSQL (Appointment).
 * Preparado para sincronización futura con Google Calendar (eventos externos).
 *
 * Entregable 6.2 (Fase 6) — Agenda Multi-Establecimiento: segundo consumidor
 * real de la misma regla de negocio que `availability.service.js` (ampliación
 * de la Reconciliación Arquitectónica de 6.2, detectada en el checkpoint de
 * la Macroetapa 2). Este archivo generaba sus propias sugerencias de horario
 * con constantes duplicadas (`GROOMING_FIRST_HOUR`, `VET_START_HOUR`, etc.)
 * — reemplazadas por `resolveHourWindow` para que la validación y las
 * sugerencias usen exactamente la misma fuente de verdad, evitando que se
 * sugiera un horario que la propia validación luego rechazaría.
 */

const prisma = require("../lib/prisma");
const {
  toDateKey,
  getDecimalHourInTimezone,
  dayBoundsInTimezone,
  zonedDateTimeToUtc,
} = require("../lib/timezone");
const {
  isBusinessDay,
  isWithinBusinessHours,
  resolveHourWindow,
  addOneDay,
  SERVICE_TYPES,
} = require("./availability.service");
const { getBusinessHours } = require("./business-config.service");
const { getAgendaExceptionForDate } = require("./agenda-exception.service");

const MAX_GROOMING_SEARCH_DAYS = 30;
const MAX_VET_SUGGESTIONS = 3;

// Fase 8 (extensión post-8.4) — D-hallazgo operativo 2026-09-03: un cliente
// pidió "hoy a las 11am" a las 12:48pm y el sistema lo validó como disponible
// y lo agendó — ni `isSlotAvailableWithConfig` (validación directa de un
// horario que el cliente propone) ni `suggestAvailableVetSlots` comparaban
// contra la hora actual, solo `findNextAvailableGroomingSlot` lo hacía. Mismo
// margen que ya usaba esa función, ahora compartido por las tres rutas.
const FUTURE_SLOT_BUFFER_MS = 30 * 60 * 1000;

/** true si `dateKey`+`hour` (hora del establecimiento) ya pasó, con margen. */
const isPastSlot = (dateKey, hour, referenceDate) => {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate ?? Date.now());
  if (dateKey < toDateKey(ref)) return true;
  if (dateKey !== toDateKey(ref)) return false;
  const slotUtc = zonedDateTimeToUtc(dateKey, hour);
  return slotUtc < new Date(ref.getTime() + FUTURE_SLOT_BUFFER_MS);
};

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
    hour: getDecimalHourInTimezone(date),
    date,
  };
};

/**
 * Citas activas de un día (YYYY-MM-DD).
 *
 * Fix post-auditoría de seguridad (2026-09-07, hallazgo F4): esta consulta
 * no filtraba por tenant — en un despliegue multi-establecimiento, las
 * citas confirmadas de CUALQUIER tenant marcaban un slot como ocupado para
 * todos los demás (oráculo de ocupación cross-tenant + denegación de
 * reservas). Con `tenantId` se filtra a ese establecimiento (cita directa
 * o vía su dueño); sin `tenantId` se conserva el comportamiento legado
 * (todas las citas) — caso real solo en despliegues single-tenant, donde
 * no existe otro tenant con quien cruzarse.
 */
const getAppointmentsByDate = async (dateKey, tenantId) => {
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
        ...(tenantId ? { OR: [{ tenantId }, { user: { tenantId } }] } : {}),
      },
      orderBy: { date: "asc" },
    });

    return rows.map(appointmentToSlot);
  } catch (error) {
    console.error("[AvailabilityDB] getAppointmentsByDate error:", error.message);
    throw error;
  }
};

const getBookedHoursForDate = async (dateKey, serviceType, tenantId, excludeAppointmentId) => {
  const type = normalizeServiceType(serviceType);
  const appointments = await getAppointmentsByDate(dateKey, tenantId);
  const hours = new Set();

  for (const appt of appointments) {
    if (appt.id === excludeAppointmentId) continue;
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
 * Núcleo de `isSlotAvailable`, recibiendo la configuración del establecimiento
 * ya resuelta — evita volver a consultarla en llamadas repetidas dentro de un
 * mismo bucle de búsqueda (`findNextAvailableGroomingSlot`, `suggestAvailableVetSlots`).
 */
const isSlotAvailableWithConfig = async ({ dateKey, hour, serviceType, businessHours, exception, referenceDate, tenantId, bookedHours, excludeAppointmentId }) => {
  const key = toDateKey(dateKey);
  const h = Number(hour);
  const type = normalizeServiceType(serviceType);

  if (!key || !Number.isFinite(h)) {
    return false;
  }

  try {
    if (!isBusinessDay(key, businessHours, type, exception)) {
      console.log("[AvailabilityDB] Slot occupied (non-business day):", key);
      return false;
    }

    if (!isWithinBusinessHours(type, h, key, businessHours, exception)) {
      console.log("[AvailabilityDB] Slot occupied (outside hours):", h, type);
      return false;
    }

    if (h + 1 > resolveHourWindow(type, key, businessHours, exception).endHourExclusive) {
      return false;
    }

    if (isPastSlot(key, h, referenceDate)) {
      console.log("[AvailabilityDB] Slot occupied (ya pasó):", key, h, type);
      return false;
    }

    const booked = bookedHours ?? await getBookedHoursForDate(key, type, tenantId, excludeAppointmentId);

    // La unidad de capacidad existente es un turno de una hora por bucket.
    // Una cita a las 10:30 se cruza tanto con 10:00 como con 11:00.
    if ([...booked].some((bookedHour) => Math.abs(bookedHour - h) < 1)) {
      console.log("[AvailabilityDB] Slot occupied:", key, h, type);
      return false;
    }

    // Grooming: regla de orden consecutivo — no se puede saltar un slot
    if (type === SERVICE_TYPES.GROOMING) {
      const { startHour } = resolveHourWindow(type, key, businessHours, exception);
      // Los turnos de una hora empiezan en la apertura configurada, incluso a y media.
      if (Math.abs((h - startHour) - Math.round(h - startHour)) > 1e-7) return false;
      if (startHour !== null && h > startHour) {
        for (let prev = startHour; prev < h; prev++) {
          // Un turno que ya no puede reservarse no bloquea el resto del día.
          if (isPastSlot(key, prev, referenceDate)) continue;
          if (![...booked].some(bookedHour => Math.abs(bookedHour - prev) < 1e-7)) {
            console.log(`[AvailabilityDB] Grooming slot ${h}h bloqueado — slot ${prev}h sin ocupar (regla consecutiva)`);
            return false;
          }
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

/**
 * Verifica slot libre en DB para fecha/hora/tipo.
 * @param {{ dateKey: string, hour: number, serviceType: string, tenantId?: string }} params
 */
const isSlotAvailable = async ({ dateKey, hour, serviceType, tenantId, referenceDate, excludeAppointmentId }) => {
  let businessHours = null;
  let exception = null;
  try {
    businessHours = await getBusinessHours(tenantId);
  } catch (error) {
    console.error("[AvailabilityDB] isSlotAvailable: fallo leyendo configuración del establecimiento:", error.message);
    return false;
  }
  try {
    exception = await getAgendaExceptionForDate(tenantId, toDateKey(dateKey), normalizeServiceType(serviceType));
  } catch (error) {
    console.error("[AvailabilityDB] isSlotAvailable: fallo leyendo excepciones de agenda:", error.message);
    return false;
  }
  return isSlotAvailableWithConfig({ dateKey, hour, serviceType, businessHours, exception, referenceDate, tenantId, excludeAppointmentId });
};

/** Horas reservables de un día para el formulario manual del dashboard. */
const listAvailableSlotsForDate = async ({ dateKey, serviceType, tenantId, referenceDate }) => {
  const key = toDateKey(dateKey);
  const type = normalizeServiceType(serviceType);
  if (!key || ![SERVICE_TYPES.VET, SERVICE_TYPES.GROOMING].includes(type)) {
    throw new Error("Fecha o tipo de servicio inválido");
  }

  const businessHours = await getBusinessHours(tenantId);
  const exception = await getAgendaExceptionForDate(tenantId, key, type);
  if (!isBusinessDay(key, businessHours, type, exception)) return [];

  const { startHour, endHourExclusive } = resolveHourWindow(type, key, businessHours, exception);
  if (startHour === null || endHourExclusive === null) return [];
  const bookedHours = await getBookedHoursForDate(key, type, tenantId);
  const step = type === SERVICE_TYPES.VET ? 0.5 : 1;
  const slots = [];

  for (let h = startHour; h + 1 <= endHourExclusive && h < 24; h += step) {
    if (await isSlotAvailableWithConfig({
      dateKey: key, hour: h, serviceType: type, businessHours, exception,
      referenceDate, tenantId, bookedHours,
    })) slots.push(h);
  }
  return slots;
};

/**
 * Próximo turno grooming libre (1h) en los próximos 30 días hábiles.
 * Solo retorna slots al menos 30 minutos en el futuro (hora Bogotá).
 * @param {{ referenceDate?: Date|string, tenantId?: string }} [options]
 * @returns {Promise<{ date: string, hour: number }|null>}
 */
const findNextAvailableGroomingSlot = async (options = {}) => {
  const referenceDate =
    options.referenceDate instanceof Date
      ? options.referenceDate
      : new Date(options.referenceDate ?? Date.now());

  let cursor = toDateKey(referenceDate) || toDateKey(new Date());

  let businessHours = null;
  try {
    businessHours = await getBusinessHours(options.tenantId);
  } catch (error) {
    console.error("[AvailabilityDB] findNextAvailableGroomingSlot: fallo leyendo configuración del establecimiento:", error.message);
    return null;
  }

  try {
    for (let day = 0; day < MAX_GROOMING_SEARCH_DAYS; day += 1) {
      const exception = await getAgendaExceptionForDate(options.tenantId, cursor, SERVICE_TYPES.GROOMING);
      if (!isBusinessDay(cursor, businessHours, SERVICE_TYPES.GROOMING, exception)) {
        cursor = addOneDay(cursor);
        continue;
      }

      const { startHour, endHourExclusive } = resolveHourWindow(SERVICE_TYPES.GROOMING, cursor, businessHours, exception);

      for (let h = startHour; h + 1 <= endHourExclusive; h += 1) {
        const available = await isSlotAvailableWithConfig({
          dateKey: cursor,
          hour: h,
          serviceType: SERVICE_TYPES.GROOMING,
          businessHours,
          exception,
          referenceDate,
          tenantId: options.tenantId,
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
 * Hasta 3 horas vet libres en un día (11am–5pm inicio por defecto, o el
 * horario real configurado por el establecimiento).
 * @param {{ dateKey: string, requestedHour?: number, limit?: number, tenantId?: string }} params
 * @returns {Promise<{ dateKey: string, hours: number[] }>}
 */
const suggestAvailableVetSlots = async ({
  dateKey,
  requestedHour,
  limit = MAX_VET_SUGGESTIONS,
  tenantId,
  referenceDate,
} = {}) => {
  let key = toDateKey(dateKey) || toDateKey(new Date());
  const max = Math.min(Math.max(Number(limit) || MAX_VET_SUGGESTIONS, 1), 10);
  const requested = Number(requestedHour);

  let businessHours = null;
  try {
    businessHours = await getBusinessHours(tenantId);
  } catch (error) {
    console.error("[AvailabilityDB] suggestAvailableVetSlots: fallo leyendo configuración del establecimiento:", error.message);
    return { dateKey: key, hours: [] };
  }

  try {
    let exception = await getAgendaExceptionForDate(tenantId, key, SERVICE_TYPES.VET);
    if (!key || !isBusinessDay(key, businessHours, SERVICE_TYPES.VET, exception)) {
      let cursor = key || toDateKey(new Date());
      for (let i = 0; i < 14; i += 1) {
        exception = await getAgendaExceptionForDate(tenantId, cursor, SERVICE_TYPES.VET);
        if (isBusinessDay(cursor, businessHours, SERVICE_TYPES.VET, exception)) {
          key = cursor;
          break;
        }
        cursor = addOneDay(cursor);
      }
    }

    const booked = await getBookedHoursForDate(key, SERVICE_TYPES.VET, tenantId);
    const suggestions = [];
    const { startHour, endHourExclusive } = resolveHourWindow(SERVICE_TYPES.VET, key, businessHours, exception);

    for (let h = startHour; h + 1 <= endHourExclusive; h += 1) {
      if (Number.isFinite(requested) && h === requested) {
        continue;
      }
      if ([...booked].some(bookedHour => Math.abs(bookedHour - h) < 1)) {
        continue;
      }
      if (!isWithinBusinessHours(SERVICE_TYPES.VET, h, key, businessHours, exception)) {
        continue;
      }
      if (isPastSlot(key, h, referenceDate)) {
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
  listAvailableSlotsForDate,
  findNextAvailableGroomingSlot,
  suggestAvailableVetSlots,
  getSchedulingAppointments,
  MAX_GROOMING_SEARCH_DAYS,
};
