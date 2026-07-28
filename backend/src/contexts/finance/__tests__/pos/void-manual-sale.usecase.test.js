/**
 * Entregable 6.4 (Fase 6) — cobertura de regresión que no existía para este
 * caso de uso (brecha de test encontrada en la auditoría de la Macroetapa 1).
 */
const { createVoidManualSaleUseCase } = require("../../application/use-cases/pos/void-manual-sale.usecase");
const { createFakeTransactionRepository, createFakeDailyCloseRepository, createFakeEventPublisher } = require("../fakes");
const {
  TransactionNotFoundError,
  TransactionAlreadyVoidedError,
  InvalidTransactionOperationError,
  DailyCloseAlreadyExistsForDateError,
} = require("../../domain/errors");

const SALE = {
  id: "tx-1",
  tenantId: "t1",
  origin: "manual_pos_sale",
  status: "active",
  paidAt: new Date("2026-07-01T15:00:00.000Z"),
};

function buildUseCase({ transactions = [{ ...SALE }], dailyCloses = [] } = {}) {
  const transactionRepository = createFakeTransactionRepository(transactions);
  const dailyCloseRepository = createFakeDailyCloseRepository(dailyCloses);
  const eventPublisher = createFakeEventPublisher();
  const execute = createVoidManualSaleUseCase({ transactionRepository, dailyCloseRepository, eventPublisher });
  return { execute, eventPublisher };
}

describe("VoidManualSaleUseCase", () => {
  test("anula una venta manual activa y emite VentaAnulada", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { transaction } = await execute({ tenantId: "t1", transactionId: "tx-1", reason: "error de cobro" });
    expect(transaction.status).toBe("voided");
    expect(eventPublisher.events[0].eventName).toBe("VentaAnulada");
  });

  test("rechaza la ausencia de reason", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", transactionId: "tx-1" })).rejects.toBeInstanceOf(
      InvalidTransactionOperationError
    );
  });

  test("rechaza si la venta no existe", async () => {
    const { execute } = buildUseCase({ transactions: [] });
    await expect(execute({ tenantId: "t1", transactionId: "no-existe", reason: "x" })).rejects.toBeInstanceOf(
      TransactionNotFoundError
    );
  });

  test("rechaza si no es una venta manual (p. ej. cobro de sistema)", async () => {
    const { execute } = buildUseCase({ transactions: [{ ...SALE, origin: "system_appointment_completed" }] });
    await expect(execute({ tenantId: "t1", transactionId: "tx-1", reason: "x" })).rejects.toBeInstanceOf(
      InvalidTransactionOperationError
    );
  });

  test("rechaza si la venta ya fue anulada", async () => {
    const { execute } = buildUseCase({ transactions: [{ ...SALE, status: "voided" }] });
    await expect(execute({ tenantId: "t1", transactionId: "tx-1", reason: "x" })).rejects.toBeInstanceOf(
      TransactionAlreadyVoidedError
    );
  });

  test("rechaza si el día civil de la venta ya tiene Cierre oficial", async () => {
    const { execute } = buildUseCase({
      dailyCloses: [
        { id: "close-1", tenantId: "t1", date: new Date("2026-07-01T00:00:00.000Z"), incomeTotal: 0, expenseTotal: 0, netAmount: 0, staffBreakdown: [] },
      ],
    });
    await expect(execute({ tenantId: "t1", transactionId: "tx-1", reason: "x" })).rejects.toBeInstanceOf(
      DailyCloseAlreadyExistsForDateError
    );
  });

  test("Entregable 6.4 — rechaza como TransactionNotFoundError si la venta pertenece a otro establecimiento", async () => {
    const { execute } = buildUseCase({ transactions: [{ ...SALE, tenantId: "t2" }] });
    await expect(execute({ tenantId: "t1", transactionId: "tx-1", reason: "x" })).rejects.toBeInstanceOf(
      TransactionNotFoundError
    );
  });
});
