const {
  TransactionNotFoundError,
  InvalidTransactionOperationError,
} = require("../../../domain/errors");
const { civilDateKey, civilDateLabel } = require('../../../../shared/business-day');
const { PAYMENT_METHODS, resolvePayment } = require('../../../domain/payment-allocation');

/**
 * SettleSystemChargeUseCase — Operación de caja (proceso: POS; hecho: Finanzas).
 * ADR 007-D3(a): el POS liquida el cobro de sistema de una cita — actualiza
 * paymentMethod y notes, NUNCA el monto (precio resuelto congelado).
 */
function createSettleSystemChargeUseCase({ transactionRepository, eventPublisher, businessDayGate, dailyCloseRepository, clock = () => new Date() }) {
  return async function execute({ tenantId, appointmentId, paymentMethod, cashAmount, transferAmount, notes, recordedBy }, ctx) {
    if (!appointmentId) {
      throw new InvalidTransactionOperationError("appointmentId es obligatorio.");
    }
    if (paymentMethod === undefined && notes === undefined) {
      throw new InvalidTransactionOperationError("Nada que liquidar: indica paymentMethod y/o notes.");
    }
    if ((paymentMethod !== undefined && !PAYMENT_METHODS.includes(paymentMethod)) || (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) || (paymentMethod === undefined && (cashAmount != null || transferAmount != null))) throw new InvalidTransactionOperationError('Revisa el medio de pago y las notas del cobro.');

    const charge = ctx && tenantId && transactionRepository.lockByAppointment
      ? await transactionRepository.lockByAppointment(tenantId, appointmentId, ctx)
      : await transactionRepository.findActiveByAppointment(appointmentId, "system_appointment_completed", ctx);
    if (!charge || (tenantId && charge.tenantId !== tenantId)) {
      throw new TransactionNotFoundError(`cobro de sistema de la cita ${appointmentId}`);
    }

    const payment = paymentMethod === undefined ? null : resolvePayment({ paymentMethod, cashAmount, transferAmount }, charge.total);
    if (charge.paidAt != null && charge.recordedActorId) {
      const sameParts = !payment || payment.paymentMethod !== 'mixed' || (Number(charge.cashAmount) === Number(payment.cashAmount) && Number(charge.transferAmount) === Number(payment.transferAmount));
      if (sameParts && (paymentMethod === undefined || paymentMethod === charge.paymentMethod) && (notes === undefined || (notes || null) === (charge.notes || null))) return { transaction: charge };
      throw new InvalidTransactionOperationError('El pago ya fue confirmado con otros datos. Actualiza Caja.');
    }
    let paidAt;
    if (payment?.paymentMethod === 'mixed' && charge.paidAt != null) {
      const originalDay = civilDateKey(charge.paidAt);
      if (businessDayGate) await businessDayGate.acquire(tenantId, originalDay, ctx);
      if (dailyCloseRepository && await dailyCloseRepository.findByDate(tenantId, civilDateLabel(originalDay), ctx)) throw new InvalidTransactionOperationError('El día de este cobro ya tiene cierre oficial.');
    }
    if (charge.paidAt === null) {
      if (!tenantId || !recordedBy?.id || !PAYMENT_METHODS.includes(paymentMethod)) throw new InvalidTransactionOperationError('Confirma el medio de pago y el operador antes de registrar el dinero recibido.');
      paidAt = clock();
      const day = civilDateKey(paidAt);
      if (businessDayGate) await businessDayGate.acquire(tenantId, day, ctx);
      if (dailyCloseRepository && await dailyCloseRepository.findByDate(tenantId, civilDateLabel(day), ctx)) throw new InvalidTransactionOperationError('La Caja de hoy ya tiene un cierre oficial. No se puede registrar otro pago en ese día.');
    }
    const settled = await transactionRepository.settle(charge.id, { ...(payment ?? {}), notes, ...(recordedBy ? { recordedBy } : {}), ...(paidAt !== undefined ? { paidAt } : {}) }, ctx);

    await (ctx?.eventPublisher ?? eventPublisher).publish("CobroLiquidado", { transaction: settled });

    return { transaction: settled };
  };
}

module.exports = { createSettleSystemChargeUseCase };
