const {
  TransactionNotFoundError,
  InvalidTransactionOperationError,
} = require("../../../domain/errors");
const { civilDateKey, civilDateLabel } = require('../../../../shared/business-day');

/**
 * SettleSystemChargeUseCase — Operación de caja (proceso: POS; hecho: Finanzas).
 * ADR 007-D3(a): el POS liquida el cobro de sistema de una cita — actualiza
 * paymentMethod y notes, NUNCA el monto (precio resuelto congelado).
 */
function createSettleSystemChargeUseCase({ transactionRepository, eventPublisher, businessDayGate, dailyCloseRepository, clock = () => new Date() }) {
  return async function execute({ tenantId, appointmentId, paymentMethod, notes, recordedBy }, ctx) {
    if (!appointmentId) {
      throw new InvalidTransactionOperationError("appointmentId es obligatorio.");
    }
    if (paymentMethod === undefined && notes === undefined) {
      throw new InvalidTransactionOperationError("Nada que liquidar: indica paymentMethod y/o notes.");
    }
    if ((paymentMethod !== undefined && !['cash', 'transfer', 'card', 'other'].includes(paymentMethod)) || (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000))) throw new InvalidTransactionOperationError('Revisa el medio de pago y las notas del cobro.');

    const charge = ctx && tenantId && transactionRepository.lockByAppointment
      ? await transactionRepository.lockByAppointment(tenantId, appointmentId, ctx)
      : await transactionRepository.findActiveByAppointment(appointmentId, "system_appointment_completed", ctx);
    if (!charge || (tenantId && charge.tenantId !== tenantId)) {
      throw new TransactionNotFoundError(`cobro de sistema de la cita ${appointmentId}`);
    }

    if (charge.paidAt != null && charge.recordedActorId) {
      if ((paymentMethod === undefined || paymentMethod === charge.paymentMethod) && (notes === undefined || (notes || null) === (charge.notes || null))) return { transaction: charge };
      throw new InvalidTransactionOperationError('El pago ya fue confirmado con otros datos. Actualiza Caja.');
    }
    let paidAt;
    if (charge.paidAt === null) {
      if (!tenantId || !recordedBy?.id || !['cash', 'transfer', 'card', 'other'].includes(paymentMethod)) throw new InvalidTransactionOperationError('Confirma el medio de pago y el operador antes de registrar el dinero recibido.');
      paidAt = clock();
      const day = civilDateKey(paidAt);
      if (businessDayGate) await businessDayGate.acquire(tenantId, day, ctx);
      if (dailyCloseRepository && await dailyCloseRepository.findByDate(tenantId, civilDateLabel(day), ctx)) throw new InvalidTransactionOperationError('La Caja de hoy ya tiene un cierre oficial. No se puede registrar otro pago en ese día.');
    }
    const settled = await transactionRepository.settle(charge.id, { paymentMethod, notes, ...(recordedBy ? { recordedBy } : {}), ...(paidAt !== undefined ? { paidAt } : {}) }, ctx);

    await (ctx?.eventPublisher ?? eventPublisher).publish("CobroLiquidado", { transaction: settled });

    return { transaction: settled };
  };
}

module.exports = { createSettleSystemChargeUseCase };
