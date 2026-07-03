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
function createVoidManualSaleUseCase({ transactionRepository, dailyCloseRepository, eventPublisher }) {
  return async function execute({ tenantId, transactionId, reason }) {
    if (!reason || !reason.trim()) {
      throw new InvalidTransactionOperationError("reason es obligatorio para anular una venta.");
    }

    const transaction = await transactionRepository.findById(transactionId);
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
    const close = await dailyCloseRepository.findByDate(transaction.tenantId ?? null, civilDateLabel(ymd));
    if (close) {
      throw new DailyCloseAlreadyExistsForDateError(ymd);
    }

    const voided = await transactionRepository.void(transactionId, {
      voidedAt: new Date(),
      voidReason: reason,
    });

    await eventPublisher.publish("VentaAnulada", { transaction: voided });

    return { transaction: voided };
  };
}

module.exports = { createVoidManualSaleUseCase };
