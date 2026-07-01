const { createGetFinancialPeriodUseCase } = require("../application/use-cases/get-financial-period.usecase");
const { createFakeFinancialPeriodRepository } = require("./fakes");
const { FinancialPeriodNotFoundError } = require("../domain/errors");

describe("GetFinancialPeriodUseCase", () => {
  test("devuelve el Período Financiero ya congelado, sin recalcular", async () => {
    const financialPeriodRepository = createFakeFinancialPeriodRepository([
      { id: "period-1", tenantId: "t1", periodStart: new Date("2026-07-01T00:00:00.000Z"), periodEnd: new Date("2026-07-02T00:00:00.000Z"), incomeTotal: 100, expenseTotal: 10, netAmount: 90, breakdown: [] },
    ]);
    const execute = createGetFinancialPeriodUseCase({ financialPeriodRepository });
    const { financialPeriod } = await execute({ tenantId: "t1", periodStart: "2026-07-01", periodEnd: "2026-07-02" });
    expect(financialPeriod.id).toBe("period-1");
  });

  test("rechaza si no existe un Período Financiero para ese rango", async () => {
    const financialPeriodRepository = createFakeFinancialPeriodRepository();
    const execute = createGetFinancialPeriodUseCase({ financialPeriodRepository });
    await expect(execute({ tenantId: "t1", periodStart: "2026-07-01", periodEnd: "2026-07-02" })).rejects.toBeInstanceOf(
      FinancialPeriodNotFoundError
    );
  });
});
