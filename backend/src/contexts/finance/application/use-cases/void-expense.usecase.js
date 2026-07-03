const {
  ExpenseNotFoundError,
  ExpenseAlreadyVoidedError,
  DailyCloseAlreadyExistsForDateError,
  InvalidExpenseAttributesError,
} = require("../../domain/errors");
const { civilDateKey, civilDateLabel } = require("../../../shared/business-day");

/**
 * VoidExpenseUseCase — Administración.
 * Implementa "Anular Gasto". Nunca edita: marca el original como anulado,
 * preservando el registro intacto (sistema-operativo-finanzas.md, caso de uso 2).
 * El guard de día cerrado usa el día civil del negocio (ADR 008).
 *
 * @param {Object} deps
 * @param {import("../ports/expense-repository.port").ExpenseRepositoryPort} deps.expenseRepository
 * @param {import("../ports/daily-close-repository.port").DailyCloseRepositoryPort} deps.dailyCloseRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createVoidExpenseUseCase({ expenseRepository, dailyCloseRepository, eventPublisher }) {
  return async function execute({ tenantId, expenseId, reason }) {
    if (!reason || !reason.trim()) {
      throw new InvalidExpenseAttributesError("reason es obligatorio para anular un gasto.");
    }

    const expense = await expenseRepository.findById(expenseId);
    if (!expense || (tenantId && expense.tenantId !== tenantId)) {
      throw new ExpenseNotFoundError(expenseId);
    }
    if (expense.status === "voided") {
      throw new ExpenseAlreadyVoidedError(expenseId);
    }

    const ymd = civilDateKey(expense.date);
    const existingClose = await dailyCloseRepository.findByDate(expense.tenantId ?? null, civilDateLabel(ymd));
    if (existingClose) {
      throw new DailyCloseAlreadyExistsForDateError(ymd);
    }

    const voided = await expenseRepository.void(expenseId, {
      voidedAt: new Date(),
      voidReason: reason,
    });

    await eventPublisher.publish("GastoAnulado", { expense: voided });

    return { expense: voided };
  };
}

module.exports = { createVoidExpenseUseCase };
