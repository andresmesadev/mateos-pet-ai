const { FinancialPeriodNotFoundError } = require("../../domain/errors");

/**
 * GetFinancialPeriodUseCase — Consulta.
 * Lectura pura de un hecho ya congelado — no recalcula nada.
 */
function createGetFinancialPeriodUseCase({ financialPeriodRepository }) {
  return async function execute({ tenantId, periodStart, periodEnd }) {
    const financialPeriod = await financialPeriodRepository.findByRange(
      tenantId ?? null,
      new Date(periodStart),
      new Date(periodEnd)
    );
    if (!financialPeriod) {
      throw new FinancialPeriodNotFoundError(periodStart, periodEnd);
    }
    return { financialPeriod };
  };
}

module.exports = { createGetFinancialPeriodUseCase };
