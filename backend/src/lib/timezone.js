/**
 * Fechas y horas en timezone de negocio: Colombia (America/Bogota).
 * PostgreSQL guarda instants UTC; toda lógica de calendario usa esta zona.
 */

const { addDays } = require("date-fns");
const { formatInTimeZone, fromZonedTime } = require("date-fns-tz");

const TIMEZONE = "America/Bogota";

const isDateKey = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * YYYY-MM-DD en America/Bogota para un instante UTC.
 * @param {Date|string|number} date
 * @returns {string|null}
 */
const toDateKey = (date) => {
  if (isDateKey(date)) {
    return date;
  }

  const d = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return formatInTimeZone(d, TIMEZONE, "yyyy-MM-dd");
};

/**
 * Hora entera 0–23 en America/Bogota.
 * @param {Date|string|number} date
 * @returns {number}
 */
const getHourInTimezone = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return parseInt(formatInTimeZone(d, TIMEZONE, "H"), 10);
};

/**
 * Día de semana JS (0=domingo … 6=sábado) para un dateKey calendario en Bogotá.
 * @param {string} dateKey
 */
const getDayOfWeekFromKey = (dateKey) => {
  const iso = parseInt(
    formatInTimeZone(
      fromZonedTime(`${dateKey}T12:00:00`, TIMEZONE),
      TIMEZONE,
      "i"
    ),
    10
  );
  return iso % 7;
};

/**
 * Partes calendario Y/M/D en Bogotá (monthIndex 0–11).
 */
const getZonedYearMonthDay = (date) => {
  const d = date instanceof Date ? date : new Date(date);

  return {
    y: parseInt(formatInTimeZone(d, TIMEZONE, "yyyy"), 10),
    m: parseInt(formatInTimeZone(d, TIMEZONE, "M"), 10) - 1,
    d: parseInt(formatInTimeZone(d, TIMEZONE, "d"), 10),
  };
};

/**
 * Construye dateKey YYYY-MM-DD validando calendario en Bogotá.
 */
const dateKeyFromParts = (y, monthIndex, day) => {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const key = `${y}-${mm}-${dd}`;
  const roundtrip = toDateKey(fromZonedTime(`${key}T12:00:00`, TIMEZONE));

  if (roundtrip !== key) {
    return null;
  }

  return key;
};

/**
 * Instant UTC = dateKey + hour en America/Bogota.
 */
const zonedDateTimeToUtc = (dateKey, hour, minute = 0, second = 0, ms = 0) => {
  const key = String(dateKey || "").trim();
  const h = Number(hour);

  if (!isDateKey(key) || !Number.isFinite(h) || h < 0 || h > 23) {
    throw new Error("Invalid dateKey or hour for zoned datetime");
  }

  const hourStr = String(Math.floor(h)).padStart(2, "0");
  const minuteStr = String(Math.floor(minute)).padStart(2, "0");
  const secondStr = String(Math.floor(second)).padStart(2, "0");
  const msStr = String(Math.floor(ms)).padStart(3, "0");

  return fromZonedTime(
    `${key}T${hourStr}:${minuteStr}:${secondStr}.${msStr}`,
    TIMEZONE
  );
};

/**
 * Inicio/fin de día calendario en Bogotá como instants UTC.
 */
const dayBoundsInTimezone = (dateKey) => {
  const key = toDateKey(dateKey);

  if (!key) {
    throw new Error("dateKey must be YYYY-MM-DD");
  }

  return {
    start: fromZonedTime(`${key}T00:00:00.000`, TIMEZONE),
    end: fromZonedTime(`${key}T23:59:59.999`, TIMEZONE),
  };
};

/**
 * Siguiente día calendario (YYYY-MM-DD) en Bogotá.
 */
const addOneDay = (dateKey) => {
  const key = toDateKey(dateKey);

  if (!key) {
    return null;
  }

  const noon = fromZonedTime(`${key}T12:00:00`, TIMEZONE);
  return toDateKey(addDays(noon, 1));
};

/**
 * Texto amigable para confirmación al usuario (hora Colombia).
 */
const formatSlotForUser = (dateKey, hour) => {
  const key = toDateKey(dateKey);
  const h = Number(hour);

  if (!key || !Number.isFinite(h)) {
    return "";
  }

  const utc = zonedDateTimeToUtc(key, h);
  const dateLabel = formatInTimeZone(utc, TIMEZONE, "dd/MM/yyyy");
  const timeLabel = formatInTimeZone(utc, TIMEZONE, "h:mm a");

  return `${dateLabel} a las ${timeLabel} (hora Colombia)`;
};

module.exports = {
  TIMEZONE,
  toDateKey,
  getHourInTimezone,
  getDayOfWeekFromKey,
  getZonedYearMonthDay,
  dateKeyFromParts,
  zonedDateTimeToUtc,
  dayBoundsInTimezone,
  addOneDay,
  formatSlotForUser,
  fromZonedTime,
  formatInTimeZone,
};
