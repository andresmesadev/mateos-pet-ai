const { summarizePeriod } = require("../../domain/rules/financial-summary.rules");
const { enumerateDates, findMissingDates } = require("../../domain/rules/period-completeness.rules");
const { IncompleteFinancialPeriodError, DuplicateFinancialPeriodError } = require("../../domain/errors");

/**
 * GenerateFinancialPeriodUseCase — Administración.
 * Implementa "Generar Período Financiero". Un Período Financiero es una
 * partición del tiempo: solo consolida Cierres del Día ya oficiales, y una
 * vez asignado un día a un período, esa asociación es inmutable
 * (finanzas-modelo-persistencia.md, finanzas-esquema-fisico.md).
 *
 * @param {Object} deps
 * @param {import("../ports/daily-close-repository.port").DailyCloseRepositoryPort} deps.dailyCloseRepository
 * @param {import("../ports/financial-period-repository.port").FinancialPeriodRepositoryPort} deps.financialPeriodRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createGenerateFinancialPeriodUseCase({ dailyCloseRepository, financialPeriodRepository, eventPublisher }) {
  return async function execute({ tenantId, periodStart, periodEnd }) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const existing = await financialPeriodRepository.findByRange(tenantId ?? null, start, end);
    if (existing) {
      throw new DuplicateFinancialPeriodError(periodStart, periodEnd);
    }

    const expectedDates = enumerateDates(start, end);
    const dailyCloses = await dailyCloseRepository.listByDateRange(tenantId ?? null, start, end);

    const missingDates = findMissingDates(expectedDates, dailyCloses);
    if (missingDates.length > 0) {
      throw new IncompleteFinancialPeriodError(missingDates);
    }

    const summary = summarizePeriod(dailyCloses);

    let financialPeriod;
    try {
      financialPeriod = await financialPeriodRepository.create({
        tenantId: tenantId ?? null,
        periodStart: start,
        periodEnd: end,
        incomeTotal: summary.incomeTotal,
        expenseTotal: summary.expenseTotal,
        netAmount: summary.netAmount,
        breakdown: summary.breakdown,
      });
    } catch (err) {
      if (err && err.code === "UNIQUE_FINANCIAL_PERIOD_VIOLATION") {
        throw new DuplicateFinancialPeriodError(periodStart, periodEnd);
      }
      throw err;
    }

    // Asignación condicionada (financialPeriodId IS NULL) — protege la
    // partición del tiempo contra una condición de carrera entre dos
    // generaciones concurrentes del mismo rango.
    const dailyCloseIds = dailyCloses.map((d) => d.id);
    const assignedCount = await dailyCloseRepository.assignToPeriod(dailyCloseIds, financialPeriod.id);
    if (assignedCount !== dailyCloseIds.length) {
      throw new DuplicateFinancialPeriodError(periodStart, periodEnd);
    }

    await eventPublisher.publish("PeríodoFinancieroGenerado", { financialPeriod });

    return { financialPeriod };
  };
}

module.exports = { createGenerateFinancialPeriodUseCase };
