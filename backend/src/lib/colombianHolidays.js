/**
 * Festivos nacionales de Colombia (Ley 51 de 1983 — Ley Emiliani).
 * Cálculo algorítmico para cualquier año (reglas festivos.com.co).
 */

const { addDays } = require("date-fns");
const {
  TIMEZONE,
  toDateKey,
  getDayOfWeekFromKey,
  dateKeyFromParts,
  fromZonedTime,
} = require("./timezone");

/** @type {Map<number, Map<string, string>>} */
const holidaysByYearCache = new Map();

/**
 * Domingo de Pascua (calendario gregoriano).
 * @param {number} year
 * @returns {string} dateKey YYYY-MM-DD
 */
const getEasterSundayKey = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return dateKeyFromParts(year, month - 1, day);
};

/**
 * Suma días a un dateKey calendario en Bogotá.
 * @param {string} dateKey
 * @param {number} days
 * @returns {string|null}
 */
const addDaysToKey = (dateKey, days) => {
  const key = toDateKey(dateKey);

  if (!key || !Number.isFinite(days)) {
    return null;
  }

  const noon = fromZonedTime(`${key}T12:00:00`, TIMEZONE);
  return toDateKey(addDays(noon, days));
};

/**
 * Ley Emiliani: si la fecha no cae en lunes, trasladar al lunes siguiente.
 * @param {string} dateKey
 * @returns {string|null}
 */
const moveToFollowingMonday = (dateKey) => {
  const key = toDateKey(dateKey);

  if (!key) {
    return null;
  }

  const dayOfWeek = getDayOfWeekFromKey(key);

  if (dayOfWeek === 1) {
    return key;
  }

  const daysToAdd = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  return addDaysToKey(key, daysToAdd);
};

const setHoliday = (map, dateKey, name) => {
  const key = toDateKey(dateKey);

  if (key) {
    map.set(key, name);
  }
};

/**
 * Mapa dateKey → nombre para un año calendario.
 * @param {number} year
 * @returns {Map<string, string>}
 */
const buildHolidaysForYear = (year) => {
  const holidays = new Map();

  setHoliday(holidays, dateKeyFromParts(year, 0, 1), "Año Nuevo");
  setHoliday(holidays, dateKeyFromParts(year, 4, 1), "Día del Trabajo");
  setHoliday(holidays, dateKeyFromParts(year, 7, 7), "Batalla de Boyacá");
  setHoliday(
    holidays,
    dateKeyFromParts(year, 11, 8),
    "Inmaculada Concepción"
  );
  setHoliday(holidays, dateKeyFromParts(year, 11, 25), "Navidad");

  setHoliday(
    holidays,
    moveToFollowingMonday(dateKeyFromParts(year, 0, 6)),
    "Reyes Magos"
  );
  setHoliday(
    holidays,
    moveToFollowingMonday(dateKeyFromParts(year, 2, 19)),
    "San José"
  );
  setHoliday(
    holidays,
    moveToFollowingMonday(dateKeyFromParts(year, 5, 29)),
    "San Pedro y San Pablo"
  );
  setHoliday(
    holidays,
    moveToFollowingMonday(dateKeyFromParts(year, 7, 15)),
    "Asunción de la Virgen"
  );
  setHoliday(
    holidays,
    moveToFollowingMonday(dateKeyFromParts(year, 9, 12)),
    "Día de la Raza"
  );
  setHoliday(
    holidays,
    moveToFollowingMonday(dateKeyFromParts(year, 10, 1)),
    "Todos los Santos"
  );
  setHoliday(
    holidays,
    moveToFollowingMonday(dateKeyFromParts(year, 10, 11)),
    "Independencia de Cartagena"
  );

  const easter = getEasterSundayKey(year);

  if (easter) {
    setHoliday(holidays, addDaysToKey(easter, -3), "Jueves Santo");
    setHoliday(holidays, addDaysToKey(easter, -2), "Viernes Santo");
    setHoliday(holidays, addDaysToKey(easter, 43), "Ascensión");
    setHoliday(holidays, addDaysToKey(easter, 64), "Corpus Christi");
    setHoliday(holidays, addDaysToKey(easter, 71), "Sagrado Corazón");
  }

  return holidays;
};

const getHolidaysForYear = (year) => {
  const y = Number(year);

  if (!Number.isFinite(y) || y < 1900 || y > 2100) {
    return new Map();
  }

  if (!holidaysByYearCache.has(y)) {
    holidaysByYearCache.set(y, buildHolidaysForYear(y));
  }

  return holidaysByYearCache.get(y);
};

const resolveDateKey = (date) => {
  const key = toDateKey(date);

  if (!key) {
    return null;
  }

  return key;
};

/**
 * @param {Date|string} date
 * @returns {boolean}
 */
const isColombianHoliday = (date) => {
  const key = resolveDateKey(date);

  if (!key) {
    return false;
  }

  const year = parseInt(key.slice(0, 4), 10);
  return getHolidaysForYear(year).has(key);
};

/**
 * @param {Date|string} date
 * @returns {string|null}
 */
const getHolidayName = (date) => {
  const key = resolveDateKey(date);

  if (!key) {
    return null;
  }

  const year = parseInt(key.slice(0, 4), 10);
  return getHolidaysForYear(year).get(key) ?? null;
};

/** Festivos 2026 (referencia verificada con algoritmo Ley Emiliani). */
const COLOMBIA_HOLIDAYS_2026 = Object.freeze({
  "2026-01-01": "Año Nuevo",
  "2026-01-12": "Reyes Magos",
  "2026-03-23": "San José",
  "2026-04-02": "Jueves Santo",
  "2026-04-03": "Viernes Santo",
  "2026-05-01": "Día del Trabajo",
  "2026-05-18": "Ascensión",
  "2026-06-08": "Corpus Christi",
  "2026-06-15": "Sagrado Corazón",
  "2026-06-29": "San Pedro y San Pablo",
  "2026-08-07": "Batalla de Boyacá",
  "2026-08-17": "Asunción de la Virgen",
  "2026-10-12": "Día de la Raza",
  "2026-11-02": "Todos los Santos",
  "2026-11-16": "Independencia de Cartagena",
  "2026-12-08": "Inmaculada Concepción",
  "2026-12-25": "Navidad",
});

module.exports = {
  isColombianHoliday,
  getHolidayName,
  getHolidaysForYear,
  getEasterSundayKey,
  COLOMBIA_HOLIDAYS_2026,
};
