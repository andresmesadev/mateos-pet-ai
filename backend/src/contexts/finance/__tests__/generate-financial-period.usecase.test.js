const { createGenerateFinancialPeriodUseCase } = require("../application/use-cases/generate-financial-period.usecase");
const { createFakeDailyCloseRepository, createFakeFinancialPeriodRepository, createFakeEventPublisher } = require("./fakes");
const { IncompleteFinancialPeriodError, DuplicateFinancialPeriodError } = require("../domain/errors");

function buildUseCase({ dailyCloses = [] } = {}) {
  const dailyCloseRepository = createFakeDailyCloseRepository(dailyCloses);
  const financialPeriodRepository = createFakeFinancialPeriodRepository();
  const eventPublisher = createFakeEventPublisher();
  const execute = createGenerateFinancialPeriodUseCase({ dailyCloseRepository, financialPeriodRepository, eventPublisher });
  return { execute, dailyCloseRepository, eventPublisher };
}

function close(id, ymd, income, expense) {
  return { id, tenantId: "t1", date: new Date(`${ymd}T00:00:00.000Z`), incomeTotal: income, expenseTotal: expense, netAmount: income - expense, staffBreakdown: [], financialPeriodId: null };
}

describe("GenerateFinancialPeriodUseCase", () => {
  test("consolida Cierres del Día completos, asigna financialPeriodId y emite PeríodoFinancieroGenerado", async () => {
    const { execute, dailyCloseRepository, eventPublisher } = buildUseCase({
      dailyCloses: [close("c1", "2026-07-01", 1000, 100), close("c2", "2026-07-02", 2000, 200)],
    });
    const { financialPeriod } = await execute({ tenantId: "t1", periodStart: "2026-07-01", periodEnd: "2026-07-02" });
    expect(financialPeriod.incomeTotal).toBe(3000);
    expect(financialPeriod.expenseTotal).toBe(300);
    expect(dailyCloseRepository.rows.every((r) => r.financialPeriodId === financialPeriod.id)).toBe(true);
    expect(eventPublisher.events[0].eventName).toBe("PeríodoFinancieroGenerado");
  });

  test("rechaza si falta un Cierre del Día en el rango (todo o nada)", async () => {
    const { execute } = buildUseCase({ dailyCloses: [close("c1", "2026-07-01", 1000, 100)] });
    await expect(execute({ tenantId: "t1", periodStart: "2026-07-01", periodEnd: "2026-07-02" })).rejects.toBeInstanceOf(
      IncompleteFinancialPeriodError
    );
  });

  test("rechaza si ya existe un período activo para el mismo rango exacto", async () => {
    const { execute } = buildUseCase({
      dailyCloses: [close("c1", "2026-07-01", 1000, 100), close("c2", "2026-07-02", 2000, 200)],
    });
    await execute({ tenantId: "t1", periodStart: "2026-07-01", periodEnd: "2026-07-02" });
    await expect(execute({ tenantId: "t1", periodStart: "2026-07-01", periodEnd: "2026-07-02" })).rejects.toBeInstanceOf(
      DuplicateFinancialPeriodError
    );
  });

  test("un día ya asignado a un período no puede reasignarse a otro (partición del tiempo)", async () => {
    const { execute } = buildUseCase({
      dailyCloses: [close("c1", "2026-07-01", 1000, 100), close("c2", "2026-07-02", 2000, 200), close("c3", "2026-07-03", 500, 50)],
    });
    await execute({ tenantId: "t1", periodStart: "2026-07-01", periodEnd: "2026-07-02" });
    // Un segundo período que se solapa con c2 (ya asignado) debe rechazarse aunque el rango sea distinto.
    await expect(execute({ tenantId: "t1", periodStart: "2026-07-02", periodEnd: "2026-07-03" })).rejects.toBeInstanceOf(
      DuplicateFinancialPeriodError
    );
  });
});
