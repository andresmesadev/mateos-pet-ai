/**
 * Motor de disponibilidad para Mateos Pet.
 * Reglas de día hábil, horario y slots. Calendario en America/Bogota.
 *
 * Entregable 6.2 (Fase 6) — Agenda Multi-Establecimiento: Reconciliación
 * Arquitectónica puntual. El algoritmo no cambia — únicamente su fuente de
 * configuración. Si el establecimiento (`Tenant.businessHours`) tiene
 * configuración real para el día evaluado, esa configuración es la única
 * fuente de verdad para ese día. Si no la tiene (tenant sin configurar, día
 * sin entrada, o entrada malformada), el comportamiento es exactamente el
 * legado de siempre (constantes fijas por tipo de servicio, definidas más
 * abajo) — invariante verificado por `__tests__/unit/availability.service.test.js`.
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

/** Índice `getDayOfWeekFromKey` (0=domingo…6=sábado) → clave de `Tenant.businessHours`. */
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const parseHourFromTimeString = (value) => {
  if (typeof value !== "string") return null;
  const h = parseInt(value.split(":")[0], 10);
  return Number.isFinite(h) ? h : null;
};

/**
 * Configuración real del establecimiento para el día de `dateKey`, o `null`
 * si no hay configuración utilizable (tenant sin `businessHours`, día sin
 * entrada, o entrada con forma inválida) — en cuyo caso el llamador debe
 * aplicar el comportamiento legado, nunca asumir un valor aquí.
 * @param {string} dateKey
 * @param {object|null|undefined} businessHours `Tenant.businessHours`
 */
const resolveDayConfig = (dateKey, businessHours) => {
  if (!businessHours || typeof businessHours !== "object") return null;
  const dayKey = DAY_KEYS[getDayOfWeekFromKey(dateKey)];
  const entry = businessHours[dayKey];
  if (!entry || typeof entry !== "object" || typeof entry.active !== "boolean") {
    return null;
  }
  const openHour = parseHourFromTimeString(entry.open);
  const closeHour = parseHourFromTimeString(entry.close);
  if (openHour === null || closeHour === null) return null;
  return { active: entry.active, openHour, closeHour };
};

/**
 * Ventana horaria efectiva para un tipo de servicio en un día dado:
 * la configuración real del establecimiento si existe, o la ventana legada
 * hardcodeada por tipo de servicio en caso contrario. Fuente única para
 * `isWithinBusinessHours` y para cualquier consumidor que hoy duplique estas
 * constantes (ver `availability-db.service.js`).
 * @param {"vet"|"grooming"} serviceType
 * @param {string|undefined} dateKey
 * @param {object|null|undefined} businessHours
 * @returns {{ active: boolean, startHour: number|null, endHourExclusive: number|null }}
 */
const resolveHourWindow = (serviceType, dateKey, businessHours) => {
  const dayConfig = dateKey ? resolveDayConfig(dateKey, businessHours) : null;
  if (dayConfig) {
    return {
      active: dayConfig.active,
      startHour: dayConfig.openHour,
      endHourExclusive: dayConfig.closeHour,
    };
  }

  if (serviceType === SERVICE_TYPES.VET) {
    return { active: true, startHour: VET_START_HOUR, endHourExclusive: VET_END_HOUR_EXCLUSIVE };
  }
  if (serviceType === SERVICE_TYPES.GROOMING) {
    return { active: true, startHour: GROOMING_FIRST_HOUR, endHourExclusive: GROOMING_LAST_START_HOUR + 1 };
  }
  return { active: false, startHour: null, endHourExclusive: null };
};

/**
 * Día hábil: configuración real del establecimiento para ese día si existe;
 * si no, el comportamiento legado (no domingo, no festivo Colombia).
 * Un festivo cierra siempre, incluso si el día está configurado como activo
 * — los festivos no son configurables por establecimiento.
 * @param {Date|string} date
 * @param {object|null|undefined} [businessHours] `Tenant.businessHours`
 * @returns {boolean}
 */
const isBusinessDay = (date, businessHours) => {
  const key = toDateKey(date);
  if (!key) {
    console.log("[availability] isBusinessDay: fecha inválida → false");
    return false;
  }

  if (isColombianHoliday(key)) {
    const holidayName = getHolidayName(key);
    console.log(
      `[availability] isBusinessDay ${key}: festivo Colombia (${holidayName}) → false`
    );
    return false;
  }

  const dayConfig = resolveDayConfig(key, businessHours);
  if (dayConfig) {
    console.log(`[availability] isBusinessDay ${key}: configuración del establecimiento → ${dayConfig.active}`);
    return dayConfig.active;
  }

  const dayOfWeek = getDayOfWeekFromKey(key);
  if (dayOfWeek === 0) {
    console.log(`[availability] isBusinessDay ${key}: domingo (sin configuración) → false`);
    return false;
  }

  return true;
};

/**
 * La hora cae dentro del horario real del establecimiento para ese día
 * (`dateKey` + `businessHours`), o dentro del horario legado por tipo de
 * servicio si no hay configuración utilizable para ese día.
 * @param {"vet"|"grooming"} serviceType
 * @param {number} hour Entero 0–23
 * @param {string} [dateKey] día evaluado — sin él, se ignora cualquier
 *   configuración y se aplica siempre el comportamiento legado.
 * @param {object|null|undefined} [businessHours] `Tenant.businessHours`
 * @returns {boolean}
 */
const isWithinBusinessHours = (serviceType, hour, dateKey, businessHours) => {
  const h = Number(hour);
  if (!Number.isFinite(h) || h < 0 || h > 23) {
    console.log(
      `[availability] isWithinBusinessHours: hora inválida (${hour}) → false`
    );
    return false;
  }

  const window = resolveHourWindow(serviceType, dateKey, businessHours);
  if (!window.active || window.startHour === null) {
    console.log(
      `[availability] isWithinBusinessHours: tipo desconocido o establecimiento cerrado ese día ("${serviceType}") → false`
    );
    return false;
  }

  const valid = h >= window.startHour && h < window.endHourExclusive;
  console.log(
    `[availability] isWithinBusinessHours ${serviceType} ${h}h (ventana ${window.startHour}–${window.endHourExclusive}) → ${valid}`
  );
  return valid;
};

module.exports = {
  isBusinessDay,
  isWithinBusinessHours,
  resolveHourWindow,
  toDateKey,
  addOneDay,
  SERVICE_TYPES,
};
