const {
  InvalidExpenseAttributesError,
  DailyCloseAlreadyExistsForDateError,
} = require("../../domain/errors");

// Categorías propias del dominio Finanzas — no configurables desde Negocio
// (decidido en la Etapa 3 de sistema-operativo-finanzas.md).
const VALID_CATEGORIES = ["supplies", "utilities", "rent", "salary", "equipment", "marketing", "other"];

function dayBounds(date) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

/**
 * RegisterExpenseUseCase — Administración.
 * Implementa "Registrar Gasto". Un gasto no puede pertenecer a un día que ya
 * tenga un Cierre del Día generado (sistema-operativo-finanzas.md, caso de uso 1).
 *
 * @param {Object} deps
 * @param {import("../ports/expense-repository.port").ExpenseRepositoryPort} deps.expenseRepository
 * @param {import("../ports/daily-close-repository.port").DailyCloseRepositoryPort} deps.dailyCloseRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createRegisterExpenseUseCase({ expenseRepository, dailyCloseRepository, eventPublisher }) {
  return async function execute({ tenantId, amount, category, responsible, date }) {
    if (typeof amount !== "number" || amount <= 0) {
      throw new InvalidExpenseAttributesError("el monto debe ser un número positivo.");
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      throw new InvalidExpenseAttributesError(`categoría "${category}" no reconocida.`);
    }
    if (!responsible || !responsible.trim()) {
      throw new InvalidExpenseAttributesError("responsible es obligatorio.");
    }

    const expenseDate = date ? new Date(date) : new Date();
    const ymd = expenseDate.toISOString().slice(0, 10);
    const { start, end } = dayBounds(ymd);

    const existingClose = await dailyCloseRepository.findByDate(tenantId ?? null, start);
    if (existingClose) {
      throw new DailyCloseAlreadyExistsForDateError(ymd);
    }
    void end; // reservado para validaciones futuras de rango exacto de día

    const expense = await expenseRepository.create({
      tenantId: tenantId ?? null,
      amount,
      category: category ?? "other",
      responsible,
      date: expenseDate,
      status: "active",
    });

    await eventPublisher.publish("GastoRegistrado", { expense });

    return { expense };
  };
}

module.exports = { createRegisterExpenseUseCase, VALID_CATEGORIES };
