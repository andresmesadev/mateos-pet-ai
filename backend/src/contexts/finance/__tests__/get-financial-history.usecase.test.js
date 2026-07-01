const { createGetFinancialHistoryUseCase } = require("../application/use-cases/get-financial-history.usecase");
const {
  createFakeDailyCloseRepository,
  createFakeTransactionRepository,
  createFakeExpenseRepository,
  createFakeCommissionReader,
} = require("./fakes");

function buildUseCase({ dailyCloses = [], charges = [], expenses = [], commissions = [] } = {}) {
  const dailyCloseRepository = createFakeDailyCloseRepository(dailyCloses);
  const transactionRepository = createFakeTransactionRepository(charges);
  const expenseRepository = createFakeExpenseRepository(expenses);
  const commissionReader = createFakeCommissionReader(commissions);
  return createGetFinancialHistoryUseCase({ dailyCloseRepository, transactionRepository, expenseRepository, commissionReader });
}

describe("GetFinancialHistoryUseCase", () => {
  test("distingue días cerrados (hecho oficial) de días abiertos (vista preliminar)", async () => {
    const execute = buildUseCase({
      dailyCloses: [
        { id: "close-1", tenantId: "t1", date: new Date("2026-07-01T00:00:00.000Z"), incomeTotal: 500, expenseTotal: 0, netAmount: 500, staffBreakdown: [] },
      ],
      charges: [{ tenantId: "t1", total: 300, paidAt: new Date("2026-07-02T10:00:00Z"), origin: "manual_pos_sale" }],
    });
    const { days } = await execute({ tenantId: "t1", rangeStart: "2026-07-01", rangeEnd: "2026-07-02" });

    expect(days[0]).toMatchObject({ date: "2026-07-01", closed: true });
    expect(days[0].dailyClose.id).toBe("close-1");

    expect(days[1]).toMatchObject({ date: "2026-07-02", closed: false });
    expect(days[1].preview.incomeTotal).toBe(300);
  });

  test("la vista preliminar usa la misma regla de consolidación que el cierre oficial", async () => {
    const execute = buildUseCase({
      charges: [{ tenantId: "t1", total: 1000, paidAt: new Date("2026-07-01T10:00:00Z"), origin: "system_appointment_completed" }],
      expenses: [{ tenantId: "t1", amount: 200, date: new Date("2026-07-01T08:00:00Z"), status: "active" }],
    });
    const { days } = await execute({ tenantId: "t1", rangeStart: "2026-07-01", rangeEnd: "2026-07-01" });
    expect(days[0].preview.netAmount).toBe(800);
  });
});
