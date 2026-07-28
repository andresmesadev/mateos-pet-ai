/**
 * Entregable 6.4 (Fase 6) — cobertura de regresión que no existía para este
 * caso de uso (única brecha de test encontrada en la auditoría de la
 * Macroetapa 1 dentro de la carpeta pos/). Cubre también el ajuste de
 * consistencia de tenant aplicado en esta misma macroetapa.
 */
const { createGuardManualSaleLinkUseCase } = require("../../application/use-cases/pos/guard-manual-sale-link.usecase");
const { createFakeTransactionRepository, createFakeCompletedAppointmentsReader } = require("../fakes");
const { InvalidTransactionOperationError } = require("../../domain/errors");

const APPOINTMENT = { id: "appt-1", tenantId: "t1", status: "completed" };
const SYSTEM_CHARGE = { id: "tx-1", tenantId: "t1", appointmentId: "appt-1", origin: "system_appointment_completed", status: "active" };

function buildUseCase({ appointments = [APPOINTMENT], transactions = [SYSTEM_CHARGE] } = {}) {
  const transactionRepository = createFakeTransactionRepository(transactions);
  const completedAppointmentsReader = createFakeCompletedAppointmentsReader(appointments);
  const execute = createGuardManualSaleLinkUseCase({ transactionRepository, completedAppointmentsReader });
  return { execute };
}

describe("GuardManualSaleLinkUseCase", () => {
  test("sin appointmentId, permite la venta de mostrador sin restricciones", async () => {
    const { execute } = buildUseCase();
    const result = await execute({ tenantId: "t1" });
    expect(result).toEqual({ allowed: true });
  });

  test("permite la venta vinculada cuando la cita está completada y tiene cobro de sistema", async () => {
    const { execute } = buildUseCase();
    const result = await execute({ tenantId: "t1", appointmentId: "appt-1" });
    expect(result.allowed).toBe(true);
    expect(result.systemCharge.id).toBe("tx-1");
  });

  test("rechaza si la cita no existe", async () => {
    const { execute } = buildUseCase({ appointments: [] });
    await expect(execute({ tenantId: "t1", appointmentId: "no-existe" })).rejects.toBeInstanceOf(
      InvalidTransactionOperationError
    );
  });

  test("rechaza si la cita no está completada", async () => {
    const { execute } = buildUseCase({ appointments: [{ ...APPOINTMENT, status: "scheduled" }] });
    await expect(execute({ tenantId: "t1", appointmentId: "appt-1" })).rejects.toBeInstanceOf(
      InvalidTransactionOperationError
    );
  });

  test("rechaza si la cita completada no tiene cobro de sistema", async () => {
    const { execute } = buildUseCase({ transactions: [] });
    await expect(execute({ tenantId: "t1", appointmentId: "appt-1" })).rejects.toBeInstanceOf(
      InvalidTransactionOperationError
    );
  });

  test("Entregable 6.4 — trata el cobro de sistema de otro establecimiento igual que si no existiera", async () => {
    const { execute } = buildUseCase({ transactions: [{ ...SYSTEM_CHARGE, tenantId: "t2" }] });
    await expect(execute({ tenantId: "t1", appointmentId: "appt-1" })).rejects.toBeInstanceOf(
      InvalidTransactionOperationError
    );
  });
});
