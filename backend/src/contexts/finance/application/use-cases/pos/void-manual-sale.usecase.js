const {
  TransactionNotFoundError,
  TransactionAlreadyVoidedError,
  InvalidTransactionOperationError,
  DailyCloseAlreadyExistsForDateError,
} = require("../../../domain/errors");
const { civilDateKey, civilDateLabel } = require("../../../../shared/business-day");

/**
 * VoidManualSaleUseCase — Operación de caja (proceso: POS; hecho: Finanzas).
 * Anulación + nuevo registro (patrón completo, Etapa 4): nunca edita.
 * Solo ventas manuales: el cobro de sistema no tiene comando de anulación en
 * este entregable (decisión de alcance, no del modelo).
 * Frontera: no sobre días civiles con Cierre oficial.
 */
function createVoidManualSaleUseCase({ transactionRepository, dailyCloseRepository, eventPublisher, businessDayGate, voidSaleCommissions }) {
  return async function execute({ tenantId, transactionId, reason }, ctx) {
    if (!reason || !reason.trim()) {
      throw new InvalidTransactionOperationError("reason es obligatorio para anular una venta.");
    }

    const transaction = await transactionRepository.findById(transactionId, ctx);
    if (!transaction || (tenantId && transaction.tenantId !== tenantId)) {
      throw new TransactionNotFoundError(transactionId);
    }
    if (transaction.origin !== "manual_pos_sale") {
      throw new InvalidTransactionOperationError(
        "Solo las ventas manuales pueden anularse por este comando (decisión de alcance del Entregable Puente)."
      );
    }
    if (transaction.status === "voided") {
      throw new TransactionAlreadyVoidedError(transactionId);
    }

    const ymd = civilDateKey(transaction.paidAt);
    if (businessDayGate) await businessDayGate.acquire(tenantId, ymd, ctx);
    const close = await dailyCloseRepository.findByDate(transaction.tenantId ?? null, civilDateLabel(ymd), ctx);
    if (close) {
      throw new DailyCloseAlreadyExistsForDateError(ymd);
    }

    if (voidSaleCommissions) await voidSaleCommissions({ tenantId, transactionId, reason }, ctx);
    const voided = await transactionRepository.void(transactionId, {
      voidedAt: new Date(),
      voidReason: reason,
    }, ctx);

    await (ctx?.eventPublisher ?? eventPublisher).publish("VentaAnulada", { transaction: voided });

    return { transaction: voided };
  };
}

module.exports = { createVoidManualSaleUseCase };
