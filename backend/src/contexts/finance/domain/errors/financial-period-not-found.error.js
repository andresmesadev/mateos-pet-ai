const { DomainError } = require("./domain-error");

class FinancialPeriodNotFoundError extends DomainError {
  constructor(periodStart, periodEnd) {
    super(
      "FINANCIAL_PERIOD_NOT_FOUND",
      `No existe un Período Financiero generado para el rango ${periodStart} – ${periodEnd}.`
    );
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
  }
}

module.exports = { FinancialPeriodNotFoundError };
