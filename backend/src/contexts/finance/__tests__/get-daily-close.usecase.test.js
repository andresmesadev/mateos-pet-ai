const { createGetDailyCloseUseCase } = require("../application/use-cases/get-daily-close.usecase");
const { createFakeDailyCloseRepository } = require("./fakes");
const { DailyCloseNotFoundError } = require("../domain/errors");

describe("GetDailyCloseUseCase", () => {
  test("devuelve el Cierre del Día ya congelado, sin recalcular", async () => {
    const dailyCloseRepository = createFakeDailyCloseRepository([
      { id: "close-1", tenantId: "t1", date: new Date("2026-07-01T00:00:00.000Z"), incomeTotal: 1000, expenseTotal: 100, netAmount: 900, staffBreakdown: [] },
    ]);
    const execute = createGetDailyCloseUseCase({ dailyCloseRepository });
    const { dailyClose } = await execute({ tenantId: "t1", date: "2026-07-01" });
    expect(dailyClose.id).toBe("close-1");
  });

  test("rechaza si no existe un Cierre del Día para esa fecha", async () => {
    const dailyCloseRepository = createFakeDailyCloseRepository();
    const execute = createGetDailyCloseUseCase({ dailyCloseRepository });
    await expect(execute({ tenantId: "t1", date: "2026-07-01" })).rejects.toBeInstanceOf(DailyCloseNotFoundError);
  });
});
