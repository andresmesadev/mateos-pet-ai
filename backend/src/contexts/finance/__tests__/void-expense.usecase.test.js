const { createVoidExpenseUseCase } = require("../application/use-cases/void-expense.usecase");
const { createFakeExpenseRepository, createFakeDailyCloseRepository, createFakeEventPublisher } = require("./fakes");
const {
  ExpenseNotFoundError,
  ExpenseAlreadyVoidedError,
  DailyCloseAlreadyExistsForDateError,
  InvalidExpenseAttributesError,
} = require("../domain/errors");

function buildUseCase({ expenses = [], dailyCloses = [] } = {}) {
  const expenseRepository = createFakeExpenseRepository(expenses);
  const dailyCloseRepository = createFakeDailyCloseRepository(dailyCloses);
  const eventPublisher = createFakeEventPublisher();
  const execute = createVoidExpenseUseCase({ expenseRepository, dailyCloseRepository, eventPublisher });
  return { execute, eventPublisher };
}

const EXPENSE = { id: "expense-1", tenantId: "t1", date: new Date("2026-07-01T10:00:00.000Z"), status: "active" };

describe("VoidExpenseUseCase", () => {
  test("anula un gasto activo, sin editarlo, y emite GastoAnulado", async () => {
    const { execute, eventPublisher } = buildUseCase({ expenses: [{ ...EXPENSE }] });
    const { expense } = await execute({ expenseId: "expense-1", reason: "monto duplicado" });
    expect(expense.status).toBe("voided");
    expect(expense.voidReason).toBe("monto duplicado");
    expect(eventPublisher.events[0].eventName).toBe("GastoAnulado");
  });

  test("rechaza la ausencia de reason", async () => {
    const { execute } = buildUseCase({ expenses: [{ ...EXPENSE }] });
    await expect(execute({ expenseId: "expense-1" })).rejects.toBeInstanceOf(InvalidExpenseAttributesError);
  });

  test("rechaza si el gasto no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ expenseId: "no-existe", reason: "motivo" })).rejects.toBeInstanceOf(ExpenseNotFoundError);
  });

  test("rechaza si el gasto ya fue anulado", async () => {
    const { execute } = buildUseCase({ expenses: [{ ...EXPENSE, status: "voided" }] });
    await expect(execute({ expenseId: "expense-1", reason: "motivo" })).rejects.toBeInstanceOf(ExpenseAlreadyVoidedError);
  });

  test("rechaza si el día del gasto ya tiene un Cierre del Día oficial", async () => {
    const { execute } = buildUseCase({
      expenses: [{ ...EXPENSE }],
      dailyCloses: [{ id: "close-1", tenantId: "t1", date: new Date("2026-07-01T00:00:00.000Z"), incomeTotal: 0, expenseTotal: 0, netAmount: 0, staffBreakdown: [] }],
    });
    await expect(execute({ expenseId: "expense-1", reason: "motivo" })).rejects.toBeInstanceOf(DailyCloseAlreadyExistsForDateError);
  });
});
