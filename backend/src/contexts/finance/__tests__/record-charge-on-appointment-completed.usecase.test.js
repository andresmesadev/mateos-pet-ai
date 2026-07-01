const {
  createRecordChargeOnAppointmentCompletedUseCase,
} = require("../application/use-cases/record-charge-on-appointment-completed.usecase");
const { createFakeTransactionRepository, createFakeEventPublisher } = require("./fakes");
const { InvalidChargeInputError } = require("../domain/errors");

function buildUseCase() {
  const transactionRepository = createFakeTransactionRepository();
  const eventPublisher = createFakeEventPublisher();
  const execute = createRecordChargeOnAppointmentCompletedUseCase({ transactionRepository, eventPublisher });
  return { execute, transactionRepository, eventPublisher };
}

describe("RecordChargeOnAppointmentCompletedUseCase", () => {
  test("registra una Transaction con origin system_appointment_completed y emite CobroRegistrado", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { transaction } = await execute({
      tenantId: "t1",
      appointmentId: "appt-1",
      resolvedPrice: 45000,
      completedAt: "2026-07-01T14:00:00Z",
    });
    expect(transaction.origin).toBe("system_appointment_completed");
    expect(transaction.total).toBe(45000);
    expect(transaction.items).toBeUndefined();
    expect(eventPublisher.events[0].eventName).toBe("CobroRegistrado");
  });

  test("rechaza appointmentId faltante", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", resolvedPrice: 100 })).rejects.toBeInstanceOf(InvalidChargeInputError);
  });

  test("rechaza precio nulo o negativo", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", appointmentId: "appt-1", resolvedPrice: -1 })).rejects.toBeInstanceOf(InvalidChargeInputError);
  });

  test("no puede haber dos Cobros del sistema para la misma cita (unicidad por origen)", async () => {
    const { execute } = buildUseCase();
    await execute({ tenantId: "t1", appointmentId: "appt-1", resolvedPrice: 100 });
    await expect(execute({ tenantId: "t1", appointmentId: "appt-1", resolvedPrice: 100 })).rejects.toThrow();
  });
});
