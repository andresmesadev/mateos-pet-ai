const { createGenerateSettlementUseCase } = require("../application/use-cases/generate-settlement.usecase");
const {
  createFakeStaffRepository,
  createFakeCommissionRepository,
  createFakeSettlementRepository,
  createFakeEventPublisher,
} = require("./fakes");
const { StaffNotFoundError, NoCommissionsForPeriodError, SettlementAlreadyExistsError } = require("../domain/errors");

function buildUseCase({ commissions = [] } = {}) {
  const staffRepository = createFakeStaffRepository([{ id: "s-1", tenantId: "t1", name: "Lina", active: true }]);
  const commissionRepository = createFakeCommissionRepository(commissions);
  const settlementRepository = createFakeSettlementRepository();
  const eventPublisher = createFakeEventPublisher();
  const execute = createGenerateSettlementUseCase({ staffRepository, commissionRepository, settlementRepository, eventPublisher });
  return { execute, settlementRepository, eventPublisher };
}

const PERIOD_START = "2026-07-01T00:00:00Z";
const PERIOD_END = "2026-08-01T00:00:00Z";

describe("GenerateSettlementUseCase", () => {
  test("consolida las comisiones del período y emite LiquidaciónGenerada", async () => {
    const { execute, eventPublisher } = buildUseCase({
      commissions: [
        { staffId: "s-1", staffShare: 10000, completedAt: new Date("2026-07-05T00:00:00Z") },
        { staffId: "s-1", staffShare: 5000, completedAt: new Date("2026-07-20T00:00:00Z") },
      ],
    });
    const { settlement } = await execute({ staffId: "s-1", periodStart: PERIOD_START, periodEnd: PERIOD_END });
    expect(settlement.totalAmount).toBe(15000);
    expect(settlement.status).toBe("active");
    expect(eventPublisher.events[0].eventName).toBe("LiquidaciónGenerada");
  });

  test("rechaza si el staff no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "no-existe", periodStart: PERIOD_START, periodEnd: PERIOD_END })).rejects.toBeInstanceOf(
      StaffNotFoundError
    );
  });

  test("rechaza si no hay comisiones en el período", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "s-1", periodStart: PERIOD_START, periodEnd: PERIOD_END })).rejects.toBeInstanceOf(
      NoCommissionsForPeriodError
    );
  });

  test("rechaza si ya existe una liquidación activa para el mismo staff y período", async () => {
    const { execute } = buildUseCase({
      commissions: [{ staffId: "s-1", staffShare: 1000, completedAt: new Date("2026-07-05T00:00:00Z") }],
    });
    await execute({ staffId: "s-1", periodStart: PERIOD_START, periodEnd: PERIOD_END });
    await expect(execute({ staffId: "s-1", periodStart: PERIOD_START, periodEnd: PERIOD_END })).rejects.toBeInstanceOf(
      SettlementAlreadyExistsError
    );
  });

  test("traduce la violación del índice único parcial a SettlementAlreadyExistsError (protección de carrera)", async () => {
    const { execute, settlementRepository } = buildUseCase({
      commissions: [{ staffId: "s-1", staffShare: 1000, completedAt: new Date("2026-07-05T00:00:00Z") }],
    });
    settlementRepository.findActiveByStaffAndPeriod = async () => null;
    settlementRepository.create = async () => {
      const err = new Error("duplicate");
      err.code = "UNIQUE_SETTLEMENT_VIOLATION";
      throw err;
    };
    await expect(execute({ staffId: "s-1", periodStart: PERIOD_START, periodEnd: PERIOD_END })).rejects.toBeInstanceOf(
      SettlementAlreadyExistsError
    );
  });
});
