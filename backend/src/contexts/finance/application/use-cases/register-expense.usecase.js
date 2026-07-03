const {
  InvalidExpenseAttributesError,
  DailyCloseAlreadyExistsForDateError,
  MissingTenantError,
} = require("../../domain/errors");
const { civilDateKey, civilDateLabel } = require("../../../shared/business-day");

// Categorías propias del dominio Finanzas — no configurables desde Negocio
// (decidido en la Etapa 3 de sistema-operativo-finanzas.md).
const VALID_CATEGORIES = ["supplies", "utilities", "rent", "salary", "equipment", "marketing", "other"];

/**
 * RegisterExpenseUseCase — Administración.
 * Implementa "Registrar Gasto". Un gasto no puede pertenecer a un día civil
 * (ADR 008) que ya tenga un Cierre del Día generado. Entregable Puente:
 * rechaza tenant nulo (hallazgo M1) y acepta los atributos del contrato del
 * canal (description, paymentMethod, notes) como passthrough.
 *
 * @param {Object} deps
 * @param {import("../ports/expense-repository.port").ExpenseRepositoryPort} deps.expenseRepository
 * @param {import("../ports/daily-close-repository.port").DailyCloseRepositoryPort} deps.dailyCloseRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createRegisterExpenseUseCase({ expenseRepository, dailyCloseRepository, eventPublisher }) {
  return async function execute({ tenantId, amount, category, responsible, date, description, paymentMethod, notes }) {
    if (!tenantId) {
      throw new MissingTenantError();
    }
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
    const ymd = civilDateKey(expenseDate);

    const existingClose = await dailyCloseRepository.findByDate(tenantId, civilDateLabel(ymd));
    if (existingClose) {
      throw new DailyCloseAlreadyExistsForDateError(ymd);
    }

    const expense = await expenseRepository.create({
      tenantId,
      amount,
      category: category ?? "other",
      responsible,
      date: expenseDate,
      status: "active",
      ...(description !== undefined ? { description } : {}),
      ...(paymentMethod !== undefined ? { paymentMethod } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });

    await eventPublisher.publish("GastoRegistrado", { expense });

    return { expense };
  };
}

module.exports = { createRegisterExpenseUseCase, VALID_CATEGORIES };
