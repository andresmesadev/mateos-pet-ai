const { createGenerateDailyCloseUseCase } = require("../application/use-cases/generate-daily-close.usecase");
const {
  createFakeTransactionRepository,
  createFakeExpenseRepository,
  createFakeCommissionReader,
  createFakeDailyCloseRepository,
  createFakeEventPublisher,
} = require("./fakes");
const { DuplicateDailyCloseError, IncompleteDailyCloseError, MissingTenantError } = require("../domain/errors");

function buildUseCase({ charges = [], expenses = [], commissions = [], dailyCloses = [], completedAppointments = [] } = {}) {
  const transactionRepository = createFakeTransactionRepository(charges);
  const expenseRepository = createFakeExpenseRepository(expenses);
  const commissionReader = createFakeCommissionReader(commissions);
  const dailyCloseRepository = createFakeDailyCloseRepository(dailyCloses);
  // Verificación de completitud (ADR 007-D2) — lectura puntual sobre Agenda.
  const completedAppointmentsReader = {
    async listCompletedInRange() {
      return completedAppointments;
    },
  };
  const eventPublisher = createFakeEventPublisher();
  const execute = createGenerateDailyCloseUseCase({
    transactionRepository,
    expenseRepository,
    commissionReader,
    completedAppointmentsReader,
    dailyCloseRepository,
    eventPublisher,
  });
  return { execute, eventPublisher };
}

const DATE = "2026-07-01";

describe("GenerateDailyCloseUseCase", () => {
  test("consolida Transaction (ambos orígenes) + Expense + Commission y emite CierreDíaGenerado", async () => {
    const { execute, eventPublisher } = buildUseCase({
      charges: [
        { tenantId: "t1", total: 50000, paidAt: new Date("2026-07-01T10:00:00Z"), origin: "system_appointment_completed" },
        { tenantId: "t1", total: 20000, paidAt: new Date("2026-07-01T15:00:00Z"), origin: "manual_pos_sale" },
      ],
      expenses: [{ tenantId: "t1", amount: 10000, date: new Date("2026-07-01T08:00:00Z"), status: "active" }],
      commissions: [{ tenantId: "t1", staffId: "s-1", staffShare: 25000, businessShare: 25000, completedAt: new Date("2026-07-01T10:00:00Z") }],
    });
    const { dailyClose } = await execute({ tenantId: "t1", date: DATE });
    expect(dailyClose.incomeTotal).toBe(70000);
    expect(dailyClose.expenseTotal).toBe(10000);
    expect(dailyClose.netAmount).toBe(60000);
    expect(dailyClose.staffBreakdown[0].staffShare).toBe(25000);
    expect(eventPublisher.events[0].eventName).toBe("CierreDíaGenerado");
  });

  test("rechaza si ya existe un Cierre del Día para esa fecha", async () => {
    const { execute } = buildUseCase({
      dailyCloses: [{ id: "close-1", tenantId: "t1", date: new Date("2026-07-01T00:00:00.000Z"), incomeTotal: 0, expenseTotal: 0, netAmount: 0, staffBreakdown: [] }],
    });
    await expect(execute({ tenantId: "t1", date: DATE })).rejects.toBeInstanceOf(DuplicateDailyCloseError);
  });

  // Entregable Puente — ADR 007-D2: un cierre incompleto no puede existir.
  test("rechaza el cierre si una cita completada del día no tiene cobro de sistema", async () => {
    const { execute } = buildUseCase({
      charges: [
        { tenantId: "t1", total: 50000, paidAt: new Date("2026-07-01T10:00:00Z"), origin: "system_appointment_completed", appointmentId: "appt-1" },
      ],
      completedAppointments: [{ id: "appt-1" }, { id: "appt-2" }],
    });
    await expect(execute({ tenantId: "t1", date: DATE })).rejects.toBeInstanceOf(IncompleteDailyCloseError);
  });

  test("acepta el cierre cuando toda cita completada tiene su cobro de sistema", async () => {
    const { execute } = buildUseCase({
      charges: [
        { tenantId: "t1", total: 50000, paidAt: new Date("2026-07-01T10:00:00Z"), origin: "system_appointment_completed", appointmentId: "appt-1" },
      ],
      completedAppointments: [{ id: "appt-1" }],
    });
    const { dailyClose } = await execute({ tenantId: "t1", date: DATE });
    expect(dailyClose.incomeTotal).toBe(50000);
  });

  // Entregable Puente — hallazgo M1: los hechos oficiales exigen tenant.
  test("rechaza tenantId nulo", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: null, date: DATE })).rejects.toBeInstanceOf(MissingTenantError);
  });
});
