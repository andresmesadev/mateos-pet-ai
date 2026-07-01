const { summarizeDay } = require("../../domain/rules/financial-summary.rules");
const { DuplicateDailyCloseError } = require("../../domain/errors");

function dayBounds(date) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

/**
 * GenerateDailyCloseUseCase — Administración.
 * Implementa "Generar Cierre del Día". Congela, para una fecha exacta, el
 * resultado de consolidar Transaction (ambos orígenes) + Expense + Commission
 * (leída, no recalculada) — sistema-operativo-finanzas.md, caso de uso 4.
 *
 * @param {Object} deps
 * @param {import("../ports/transaction-repository.port").TransactionRepositoryPort} deps.transactionRepository
 * @param {import("../ports/expense-repository.port").ExpenseRepositoryPort} deps.expenseRepository
 * @param {import("../ports/commission-reader.port").CommissionReaderPort} deps.commissionReader
 * @param {import("../ports/daily-close-repository.port").DailyCloseRepositoryPort} deps.dailyCloseRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createGenerateDailyCloseUseCase({
  transactionRepository,
  expenseRepository,
  commissionReader,
  dailyCloseRepository,
  eventPublisher,
}) {
  return async function execute({ tenantId, date }) {
    const { start, end } = dayBounds(date);

    const existing = await dailyCloseRepository.findByDate(tenantId ?? null, start);
    if (existing) {
      throw new DuplicateDailyCloseError(date);
    }

    const [charges, expenses, commissions] = await Promise.all([
      transactionRepository.listByDateRange(tenantId ?? null, start, end),
      expenseRepository.listByDateRange(tenantId ?? null, start, end),
      commissionReader.listByDateRange(tenantId ?? null, start, end),
    ]);

    const summary = summarizeDay({ charges, expenses, commissions });

    let dailyClose;
    try {
      dailyClose = await dailyCloseRepository.create({
        tenantId: tenantId ?? null,
        date: start,
        incomeTotal: summary.incomeTotal,
        expenseTotal: summary.expenseTotal,
        netAmount: summary.netAmount,
        staffBreakdown: summary.staffBreakdown,
      });
    } catch (err) {
      if (err && err.code === "UNIQUE_DAILY_CLOSE_VIOLATION") {
        throw new DuplicateDailyCloseError(date);
      }
      throw err;
    }

    await eventPublisher.publish("CierreDíaGenerado", { dailyClose });

    return { dailyClose };
  };
}

module.exports = { createGenerateDailyCloseUseCase };
