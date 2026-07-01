const { DomainError } = require("./domain-error");

/**
 * Un Período Financiero solo puede generarse si todos los días de su rango
 * tienen Cierre del Día oficial, sin excepción — rechazo total, sin períodos
 * parciales (sistema-operativo-finanzas.md, regla de negocio del mapa conceptual).
 */
class IncompleteFinancialPeriodError extends DomainError {
  constructor(missingDates) {
    super(
      "INCOMPLETE_FINANCIAL_PERIOD",
      `Faltan Cierres del Día oficiales para generar el período: ${missingDates.join(", ")}.`
    );
    this.missingDates = missingDates;
  }
}

module.exports = { IncompleteFinancialPeriodError };
