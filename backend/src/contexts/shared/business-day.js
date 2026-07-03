const { toDateKey, fromZonedTime, addOneDay } = require("../../lib/timezone");

/**
 * Día civil del negocio — ADR 008. lib/timezone.js es la única fuente de
 * primitivas de zona horaria; este módulo solo compone sus funciones.
 * La zona pertenece al contexto Negocio; mientras el establecimiento no tenga
 * una configurada, rige America/Bogota como valor operativo por defecto (la
 * zona por defecto ya está encapsulada en lib/timezone.js).
 */
const TIMEZONE = "America/Bogota";

// dateKey civil (YYYY-MM-DD) de un instante.
function civilDateKey(at) {
  return toDateKey(at);
}

// Etiqueta canónica del día civil (ADR 008-D2): YYYY-MM-DDT00:00:00Z.
function civilDateLabel(atOrKey) {
  const key = toDateKey(atOrKey);
  return new Date(`${key}T00:00:00.000Z`);
}

// Límites [start, end) del día civil, como instantes UTC.
function civilDayBounds(dateKey) {
  const key = toDateKey(dateKey);
  const start = fromZonedTime(`${key}T00:00:00.000`, TIMEZONE);
  const end = fromZonedTime(`${addOneDay(key)}T00:00:00.000`, TIMEZONE);
  return { start, end };
}

module.exports = { civilDateKey, civilDateLabel, civilDayBounds };
