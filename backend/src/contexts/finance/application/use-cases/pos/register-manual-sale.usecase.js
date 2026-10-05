const { InvalidTransactionOperationError, DailyCloseAlreadyExistsForDateError } = require('../../../domain/errors');
const { civilDateKey, civilDateLabel } = require('../../../../shared/business-day');
function financialCents(value) {
  const s = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof s !== 'string' || !/^\d{1,8}(\.\d{1,2})?$/.test(s)) throw new InvalidTransactionOperationError('Precio inválido: máximo dos decimales.');
  const [whole, fraction = ''] = s.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (result > 9999999999) throw new InvalidTransactionOperationError('El precio supera el límite.');
  return result;
}
function createRegisterManualSaleUseCase({ transactionRepository, referencesReader, guardManualSaleLink, dailyCloseRepository }) {
  return async function execute({ tenantId, id, actor, access, command, items, now }, ctx) {
    if (!ctx) throw new Error('RegisterManualSale requires shared transaction');
    if (!Array.isArray(items) || !items.length || items.length > 100) throw new InvalidTransactionOperationError('Agrega entre 1 y 100 artículos.');
    const paymentMethod = command.paymentMethod ?? 'cash';
    if (!['cash', 'transfer', 'card', 'other'].includes(paymentMethod)) throw new InvalidTransactionOperationError('Método de pago inválido.');
    if (!access.capabilities.cash || (!access.capabilities.administration && command.paidAt)) throw new InvalidTransactionOperationError('No puedes cambiar la fecha del cobro.');
    const paidAt = command.paidAt ? new Date(command.paidAt) : now;
    if (!Number.isFinite(paidAt.getTime())) throw new InvalidTransactionOperationError('Fecha de cobro inválida.');
    const day = civilDateKey(paidAt);
    if (await dailyCloseRepository.findByDate(tenantId, civilDateLabel(day), ctx)) throw new DailyCloseAlreadyExistsForDateError(day);
    await referencesReader.validate(tenantId, command, ctx);
    await guardManualSaleLink({ tenantId, appointmentId: command.appointmentId }, ctx);
    let total = 0;
    const computed = items.map(item => {
      if (!['service', 'product'].includes(item.itemKind) || (item.itemKind === 'product' ? !access.capabilities.retail : !access.capabilities.services)) throw new InvalidTransactionOperationError('Ese tipo de venta no está habilitado.');
      if (typeof item.description !== 'string' || !item.description.trim() || item.description.length > 250) throw new InvalidTransactionOperationError('Cada artículo necesita una descripción de máximo 250 caracteres.');
      const quantity = item.quantity ?? 1, price = financialCents(item.unitPrice);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) throw new InvalidTransactionOperationError('La cantidad debe ser entera y positiva.');
      const line = price * quantity;
      if (!Number.isSafeInteger(line) || line > 9999999999) throw new InvalidTransactionOperationError('El importe del artículo supera el límite.');
      total += line;
      if (total > 9999999999) throw new InvalidTransactionOperationError('El total supera el importe permitido.');
      return { description: item.description.trim(), itemKind: item.itemKind, quantity, unitPrice: (price / 100).toFixed(2), total: (line / 100).toFixed(2),
        ...(item.product ? { tenantId, productId: item.product.id, productCodeSnapshot: item.product.internalCode, presentationSnapshot: item.product.presentation,
          priceSourceSnapshot: 'product_base_price', priceVersionSnapshot: item.product.priceVersion } : {}) };
    });
    if (command.notes != null && (typeof command.notes !== 'string' || command.notes.length > 2000)) throw new InvalidTransactionOperationError('Nota demasiado larga.');
    return transactionRepository.createManualSale({ id, tenantId, userId: command.userId || null, petId: command.petId || null,
      appointmentId: command.appointmentId || null, paymentMethod, paidAt, origin: 'manual_pos_sale', total: (total / 100).toFixed(2),
      recordedActorId: actor.actorId, recordedActorName: actor.actorName, recordedActorRole: actor.actorRole,
      notes: command.notes?.trim() || null, items: { create: computed } }, ctx);
  };
}
module.exports = { createRegisterManualSaleUseCase, financialCents };
