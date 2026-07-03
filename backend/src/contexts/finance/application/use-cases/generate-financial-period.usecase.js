const { summarizePeriod } = require("../../domain/rules/financial-summary.rules");
const { enumerateDates, findMissingDates } = require("../../domain/rules/period-completeness.rules");
const {
  IncompleteFinancialPeriodError,
  DuplicateFinancialPeriodError,
  MissingTenantError,
} = require("../../domain/errors");

/**
 * GenerateFinancialPeriodUseCase — Administración.
 * Implementa "Generar Período Financiero". Un Período Financiero es una
 * partición del tiempo: solo consolida Cierres del Día ya oficiales, y una
 * vez asignado un día a un período, esa asociación es inmutable.
 *
 * Entregable Puente (hallazgo A2): creación + asignación + verificación de
 * conteo corren en UNA transacción — el mismatch hace rollback completo; nunca
 * queda un período huérfano con asignaciones parciales.
 *
 * @param {Object} deps — dailyCloseRepository, financialPeriodRepository, unitOfWork, eventPublisher
 */
function createGenerateFinancialPeriodUseCase({
  dailyCloseRepository,
  financialPeriodRepository,
  unitOfWork,
  eventPublisher,
}) {
  return async function execute({ tenantId, periodStart, periodEnd }) {
    if (!tenantId) {
      throw new MissingTenantError();
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const existing = await financialPeriodRepository.findByRange(tenantId, start, end);
    if (existing) {
      throw new DuplicateFinancialPeriodError(periodStart, periodEnd);
    }

    const expectedDates = enumerateDates(start, end);
    const dailyCloses = await dailyCloseRepository.listByDateRange(tenantId, start, end);

    const missingDates = findMissingDates(expectedDates, dailyCloses);
    if (missingDates.length > 0) {
      throw new IncompleteFinancialPeriodError(missingDates);
    }

    const summary = summarizePeriod(dailyCloses);
    const dailyCloseIds = dailyCloses.map((d) => d.id);

    let financialPeriod;
    try {
      financialPeriod = await unitOfWork.run(async (ctx) => {
        const period = await financialPeriodRepository.create(
          {
            tenantId,
            periodStart: start,
            periodEnd: end,
            incomeTotal: summary.incomeTotal,
            expenseTotal: summary.expenseTotal,
            netAmount: summary.netAmount,
            breakdown: summary.breakdown,
          },
          ctx
        );

        // Asignación condicionada (financialPeriodId IS NULL) — protege la
        // partición del tiempo contra generaciones concurrentes. Dentro de la
        // transacción: el mismatch revierte también la creación del período.
        const assignedCount = await dailyCloseRepository.assignToPeriod(dailyCloseIds, period.id, ctx);
        if (assignedCount !== dailyCloseIds.length) {
          throw new DuplicateFinancialPeriodError(periodStart, periodEnd);
        }

        return period;
      });
    } catch (err) {
      if (err && err.code === "UNIQUE_FINANCIAL_PERIOD_VIOLATION") {
        throw new DuplicateFinancialPeriodError(periodStart, periodEnd);
      }
      throw err;
    }

    await eventPublisher.publish("PeríodoFinancieroGenerado", { financialPeriod });

    return { financialPeriod };
  };
}

module.exports = { createGenerateFinancialPeriodUseCase };
