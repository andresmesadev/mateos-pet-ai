const {
  ExpenseNotFoundError,
  ExpenseAlreadyVoidedError,
  DailyCloseAlreadyExistsForDateError,
  InvalidExpenseAttributesError,
} = require("../../domain/errors");

function dayStart(date) {
  return new Date(date.toISOString().slice(0, 10) + "T00:00:00.000Z");
}

/**
 * VoidExpenseUseCase — Administración.
 * Implementa "Anular Gasto". Nunca edita: marca el original como anulado,
 * preservando el registro intacto (sistema-operativo-finanzas.md, caso de uso 2).
 *
 * @param {Object} deps
 * @param {import("../ports/expense-repository.port").ExpenseRepositoryPort} deps.expenseRepository
 * @param {import("../ports/daily-close-repository.port").DailyCloseRepositoryPort} deps.dailyCloseRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createVoidExpenseUseCase({ expenseRepository, dailyCloseRepository, eventPublisher }) {
  return async function execute({ expenseId, reason }) {
    if (!reason || !reason.trim()) {
      throw new InvalidExpenseAttributesError("reason es obligatorio para anular un gasto.");
    }

    const expense = await expenseRepository.findById(expenseId);
    if (!expense) {
      throw new ExpenseNotFoundError(expenseId);
    }
    if (expense.status === "voided") {
      throw new ExpenseAlreadyVoidedError(expenseId);
    }

    const ymd = expense.date.toISOString().slice(0, 10);
    const existingClose = await dailyCloseRepository.findByDate(expense.tenantId ?? null, dayStart(expense.date));
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
