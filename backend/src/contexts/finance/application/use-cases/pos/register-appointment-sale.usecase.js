const { InvalidTransactionOperationError, TransactionNotFoundError } = require('../../../domain/errors');
const { saleAmounts } = require('./register-manual-sale.usecase');
const { civilDateKey, civilDateLabel } = require('../../../../shared/business-day');
function createRegisterAppointmentSaleUseCase({ transactionRepository, referencesReader, dailyCloseRepository, businessDayGate }) {
  return async function execute({ tenantId, actor, access, command, items, now }, ctx) {
    if (!ctx?.tx || !tenantId) throw new Error('Appointment checkout requires tenant and transaction');
    if (!access.capabilities.cash || !actor.actorId) throw new InvalidTransactionOperationError('Caja requiere un operador autenticado.');
    if (command.paidAt !== undefined) throw new InvalidTransactionOperationError('El pago de la cita usa la fecha actual.');
    const paymentMethod = command.paymentMethod;
    if (!['cash', 'transfer', 'card', 'other'].includes(paymentMethod)) throw new InvalidTransactionOperationError('Método de pago inválido.');
    if (command.notes != null && (typeof command.notes !== 'string' || command.notes.length > 2000)) throw new InvalidTransactionOperationError('Nota demasiado larga.');
    const charge = await transactionRepository.lockByAppointment(tenantId, command.appointmentId, ctx);
    if (!charge) throw new TransactionNotFoundError(command.appointmentId);
    if (charge.paidAt !== null) throw new InvalidTransactionOperationError('Esta atención ya tiene un pago confirmado. Consulta su comprobante.');
    if (command.userId !== charge.userId || command.petId !== charge.petId) throw new InvalidTransactionOperationError('El propietario y mascota deben corresponder a la cita.');
    await referencesReader.validate(tenantId, command, ctx, { completed: true });
    const components = items.filter(i => i.appointmentComponent);
    if (components.filter(i => i.appointmentComponent === 'service').length !== 1 || components.filter(i => i.appointmentComponent === 'transport').length > 1) throw new InvalidTransactionOperationError('Conserva una sola línea principal del servicio de la cita.');
    const amounts = saleAmounts(items, access, true);
    const day = civilDateKey(now);
    await businessDayGate.acquire(tenantId, day, ctx);
    if (await dailyCloseRepository.findByDate(tenantId, civilDateLabel(day), ctx)) throw new InvalidTransactionOperationError('La Caja de hoy ya tiene un cierre oficial.');
    const transaction = await transactionRepository.checkoutPending(charge.id, { total: amounts.total, paymentMethod, paidAt: now,
      recordedActorId: actor.actorId, recordedActorName: actor.actorName, recordedActorRole: actor.actorRole,
      notes: command.notes?.trim() || null, items: amounts.items }, ctx);
    return { transaction, servicePrice: Number(amounts.items.find(i => i.appointmentComponent === 'service').unitPrice) };
  };
}
module.exports = { createRegisterAppointmentSaleUseCase };
