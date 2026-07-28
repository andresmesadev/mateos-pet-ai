/**
 * Entregable 6.4 (Fase 6) — cobertura de regresión que no existía para este
 * caso de uso (brecha de test encontrada en la auditoría de la Macroetapa 1).
 */
const { createSettleSystemChargeUseCase } = require("../../application/use-cases/pos/settle-system-charge.usecase");
const { createFakeTransactionRepository, createFakeEventPublisher } = require("../fakes");
const { TransactionNotFoundError, InvalidTransactionOperationError } = require("../../domain/errors");

const CHARGE = { id: "tx-1", tenantId: "t1", appointmentId: "appt-1", origin: "system_appointment_completed", status: "active" };

function buildUseCase({ transactions = [{ ...CHARGE }] } = {}) {
  const transactionRepository = createFakeTransactionRepository(transactions);
  const eventPublisher = createFakeEventPublisher();
  const execute = createSettleSystemChargeUseCase({ transactionRepository, eventPublisher });
  return { execute, eventPublisher };
}

describe("SettleSystemChargeUseCase", () => {
  test("liquida el cobro de sistema (paymentMethod/notes) y emite CobroLiquidado", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { transaction } = await execute({ tenantId: "t1", appointmentId: "appt-1", paymentMethod: "card" });
    expect(transaction.paymentMethod).toBe("card");
    expect(eventPublisher.events[0].eventName).toBe("CobroLiquidado");
  });

  test("rechaza si falta appointmentId", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", paymentMethod: "card" })).rejects.toBeInstanceOf(
      InvalidTransactionOperationError
    );
  });

  test("rechaza si no hay nada que liquidar", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", appointmentId: "appt-1" })).rejects.toBeInstanceOf(
      InvalidTransactionOperationError
    );
  });

  test("rechaza si el cobro de sistema no existe", async () => {
    const { execute } = buildUseCase({ transactions: [] });
    await expect(execute({ tenantId: "t1", appointmentId: "appt-1", notes: "x" })).rejects.toBeInstanceOf(
      TransactionNotFoundError
    );
  });

  test("Entregable 6.4 — rechaza como TransactionNotFoundError si el cobro pertenece a otro establecimiento", async () => {
    const { execute } = buildUseCase({ transactions: [{ ...CHARGE, tenantId: "t2" }] });
    await expect(
      execute({ tenantId: "t1", appointmentId: "appt-1", notes: "x" })
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
  });
});
