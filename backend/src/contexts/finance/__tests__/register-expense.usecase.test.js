const { createRegisterExpenseUseCase } = require("../application/use-cases/register-expense.usecase");
const { createFakeExpenseRepository, createFakeDailyCloseRepository, createFakeEventPublisher } = require("./fakes");
const { InvalidExpenseAttributesError, DailyCloseAlreadyExistsForDateError } = require("../domain/errors");

function buildUseCase({ dailyCloses = [] } = {}) {
  const expenseRepository = createFakeExpenseRepository();
  const dailyCloseRepository = createFakeDailyCloseRepository(dailyCloses);
  const eventPublisher = createFakeEventPublisher();
  const execute = createRegisterExpenseUseCase({ expenseRepository, dailyCloseRepository, eventPublisher });
  return { execute, expenseRepository, eventPublisher };
}

describe("RegisterExpenseUseCase", () => {
  test("registra un gasto activo y emite GastoRegistrado", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { expense } = await execute({ tenantId: "t1", amount: 5000, category: "supplies", responsible: "Ana", date: "2026-07-01" });
    expect(expense.status).toBe("active");
    expect(eventPublisher.events[0].eventName).toBe("GastoRegistrado");
  });

  test("rechaza monto no positivo", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", amount: 0, date: "2026-07-01" })).rejects.toBeInstanceOf(InvalidExpenseAttributesError);
  });

  test("rechaza categoría no reconocida", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ tenantId: "t1", amount: 100, category: "no-existe", responsible: "Ana", date: "2026-07-01" })
    ).rejects.toBeInstanceOf(InvalidExpenseAttributesError);
  });

  test("rechaza la ausencia de responsible", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", amount: 100, date: "2026-07-01" })).rejects.toBeInstanceOf(InvalidExpenseAttributesError);
  });

  test("rechaza si ya existe un Cierre del Día para esa fecha", async () => {
    const { execute } = buildUseCase({
      dailyCloses: [{ id: "close-1", tenantId: "t1", date: new Date("2026-07-01T00:00:00.000Z"), incomeTotal: 0, expenseTotal: 0, netAmount: 0, staffBreakdown: [] }],
    });
    await expect(
      // Mediodía en Bogotá — día civil 2026-07-01 (ADR 008)
      execute({ tenantId: "t1", amount: 100, responsible: "Ana", date: "2026-07-01T12:00:00-05:00" })
    ).rejects.toBeInstanceOf(DailyCloseAlreadyExistsForDateError);
  });
});
