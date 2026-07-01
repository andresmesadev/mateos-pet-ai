/**
 * Determina si un rango de fechas está completamente cubierto por Cierres
 * del Día oficiales. Usada exclusivamente por GenerateFinancialPeriodUseCase
 * (sistema-operativo-finanzas.md, sección 3 — "regla de negocio congelada a
 * partir del mapa": todo-o-nada, sin períodos parciales).
 */

function toYmd(date) {
  return date.toISOString().slice(0, 10);
}

/** @returns {string[]} fechas YYYY-MM-DD, inclusive, entre rangeStart y rangeEnd */
function enumerateDates(rangeStart, rangeEnd) {
  const dates = [];
  const cursor = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate()));
  const end = new Date(Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), rangeEnd.getUTCDate()));
  while (cursor <= end) {
    dates.push(toYmd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * @param {string[]} expectedDates
 * @param {Array<{date: Date}>} dailyCloses
 * @returns {string[]} fechas del rango sin Cierre del Día oficial
 */
function findMissingDates(expectedDates, dailyCloses) {
  const covered = new Set(dailyCloses.map((d) => toYmd(d.date)));
  return expectedDates.filter((date) => !covered.has(date));
}

function isPeriodComplete(expectedDates, dailyCloses) {
  return findMissingDates(expectedDates, dailyCloses).length === 0;
}

module.exports = { enumerateDates, findMissingDates, isPeriodComplete };
