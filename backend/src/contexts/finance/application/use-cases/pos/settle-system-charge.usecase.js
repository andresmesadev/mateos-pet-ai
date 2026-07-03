const {
  TransactionNotFoundError,
  InvalidTransactionOperationError,
} = require("../../../domain/errors");

/**
 * SettleSystemChargeUseCase — Operación de caja (proceso: POS; hecho: Finanzas).
 * ADR 007-D3(a): el POS liquida el cobro de sistema de una cita — actualiza
 * paymentMethod y notes, NUNCA el monto (precio resuelto congelado).
 */
function createSettleSystemChargeUseCase({ transactionRepository, eventPublisher }) {
  return async function execute({ tenantId, appointmentId, paymentMethod, notes }) {
    if (!appointmentId) {
      throw new InvalidTransactionOperationError("appointmentId es obligatorio.");
    }
    if (paymentMethod === undefined && notes === undefined) {
      throw new InvalidTransactionOperationError("Nada que liquidar: indica paymentMethod y/o notes.");
    }

    const charge = await transactionRepository.findActiveByAppointment(appointmentId, "system_appointment_completed");
    if (!charge || (tenantId && charge.tenantId !== tenantId)) {
      throw new TransactionNotFoundError(`cobro de sistema de la cita ${appointmentId}`);
    }

    const settled = await transactionRepository.settle(charge.id, { paymentMethod, notes });

    await eventPublisher.publish("CobroLiquidado", { transaction: settled });

    return { transaction: settled };
  };
}

module.exports = { createSettleSystemChargeUseCase };
