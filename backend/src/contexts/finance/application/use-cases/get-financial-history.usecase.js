const { summarizeDay } = require("../../domain/rules/financial-summary.rules");
const { enumerateDates } = require("../../domain/rules/period-completeness.rules");

function dayBounds(ymd) {
  const start = new Date(`${ymd}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

/**
 * GetFinancialHistoryUseCase — Consulta.
 * Implementa "Consultar Historial Financiero". Para días ya cerrados,
 * devuelve el DailyClose oficial; para días sin cerrar, calcula una vista
 * preliminar reutilizando exactamente financial-summary.rules.js — mismo
 * algoritmo que GenerateDailyCloseUseCase, nunca un segundo cálculo
 * (sistema-operativo-finanzas.md, caso de uso 7).
 *
 * @param {Object} deps
 * @param {import("../ports/daily-close-repository.port").DailyCloseRepositoryPort} deps.dailyCloseRepository
 * @param {import("../ports/transaction-repository.port").TransactionRepositoryPort} deps.transactionRepository
 * @param {import("../ports/expense-repository.port").ExpenseRepositoryPort} deps.expenseRepository
 * @param {import("../ports/commission-reader.port").CommissionReaderPort} deps.commissionReader
 */
function createGetFinancialHistoryUseCase({
  dailyCloseRepository,
  transactionRepository,
  expenseRepository,
  commissionReader,
}) {
  return async function execute({ tenantId, rangeStart, rangeEnd }) {
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);
    const expectedDates = enumerateDates(start, end);

    const dailyCloses = await dailyCloseRepository.listByDateRange(tenantId ?? null, start, end);
    const byDate = new Map(dailyCloses.map((d) => [d.date.toISOString().slice(0, 10), d]));

    const days = await Promise.all(
      expectedDates.map(async (ymd) => {
        const existing = byDate.get(ymd);
        if (existing) {
          return { date: ymd, closed: true, dailyClose: existing };
        }

        const { start: dayStart, end: dayEnd } = dayBounds(ymd);
        const [charges, expenses, commissions] = await Promise.all([
          transactionRepository.listByDateRange(tenantId ?? null, dayStart, dayEnd),
          expenseRepository.listByDateRange(tenantId ?? null, dayStart, dayEnd),
          commissionReader.listByDateRange(tenantId ?? null, dayStart, dayEnd),
        ]);
        const preview = summarizeDay({ charges, expenses, commissions });

        return { date: ymd, closed: false, preview };
      })
    );

    return { days };
  };
}

module.exports = { createGetFinancialHistoryUseCase };
