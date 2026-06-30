const { DomainError } = require("./domain-error");

/**
 * Protección de aplicación del invariante "no dos Settlement activos para el
 * mismo staff y período" (staff-modelo-persistencia.md, sección 6).
 * Complementada por el índice único parcial en base de datos
 * (staff-esquema-fisico.md, sección 3).
 */
class SettlementAlreadyExistsError extends DomainError {
  constructor(staffId, periodStart, periodEnd) {
    super(
      "SETTLEMENT_ALREADY_EXISTS",
      `Ya existe una liquidación activa para el staff "${staffId}" en el período ${periodStart} – ${periodEnd}.`
    );
    this.staffId = staffId;
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
  }
}

module.exports = { SettlementAlreadyExistsError };
