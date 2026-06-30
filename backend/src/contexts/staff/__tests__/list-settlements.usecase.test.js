const { createListSettlementsUseCase } = require("../application/use-cases/list-settlements.usecase");
const { createFakeSettlementRepository } = require("./fakes");

function buildUseCase() {
  const settlementRepository = createFakeSettlementRepository([
    { id: "set-1", tenantId: "t1", staffId: "s-1", status: "active", periodStart: new Date("2026-07-01"), periodEnd: new Date("2026-08-01") },
    { id: "set-2", tenantId: "t1", staffId: "s-2", status: "active", periodStart: new Date("2026-07-01"), periodEnd: new Date("2026-08-01") },
    { id: "set-3", tenantId: "t2", staffId: "s-3", status: "active", periodStart: new Date("2026-07-01"), periodEnd: new Date("2026-08-01") },
  ]);
  return createListSettlementsUseCase({ settlementRepository });
}

describe("ListSettlementsUseCase", () => {
  test("filtra por tenant", async () => {
    const execute = buildUseCase();
    const { settlements } = await execute({ tenantId: "t1" });
    expect(settlements.map((s) => s.id).sort()).toEqual(["set-1", "set-2"]);
  });

  test("filtra por staff", async () => {
    const execute = buildUseCase();
    const { settlements } = await execute({ staffId: "s-1" });
    expect(settlements.map((s) => s.id)).toEqual(["set-1"]);
  });

  test("sin filtros retorna todo", async () => {
    const execute = buildUseCase();
    const { settlements } = await execute({});
    expect(settlements).toHaveLength(3);
  });
});
