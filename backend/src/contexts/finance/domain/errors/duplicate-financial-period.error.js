const { DomainError } = require("./domain-error");

/**
 * Protege tanto la generación exacta duplicada de un rango como la condición
 * de carrera de la partición del tiempo: un DailyClose ya asignado a un
 * Período Financiero no puede volver a asignarse (finanzas-esquema-fisico.md, sección 3).
 */
class DuplicateFinancialPeriodError extends DomainError {
  constructor(periodStart, periodEnd) {
    super(
      "DUPLICATE_FINANCIAL_PERIOD",
      `Ya existe un Período Financiero activo para el rango ${periodStart} – ${periodEnd}, o alguno de sus días ya pertenece a otro período.`
    );
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
  }
}

module.exports = { DuplicateFinancialPeriodError };
