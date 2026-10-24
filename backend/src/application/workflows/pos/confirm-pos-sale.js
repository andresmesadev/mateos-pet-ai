const { randomUUID } = require('node:crypto');
const { fail } = require('../../../contexts/inventory/domain/policy');
const { CommissionDayClosedError, CommissionInActiveSettlementError } = require('../../../contexts/staff/domain/errors');
function buildConfirmPosSale({ inventory, finance, staff, repository, accessReader, unitOfWork, clock = () => new Date() }) {
  return async function confirm({ tenantId, actor, operationKey, command }) {
    if (!command || command.tenantId !== undefined || command.actor !== undefined || command.principalKey !== undefined) fail('INVALID_IDENTITY', 'La identidad y el establecimiento se obtienen de la sesión.', 400);
    if (command.appointmentCheckout !== undefined && typeof command.appointmentCheckout !== 'boolean') fail('INVALID_CHECKOUT', 'Tipo de cobro de cita inválido.', 400);
    if (command.appointmentCheckout && !command.appointmentId) fail('INVALID_CHECKOUT', 'Selecciona la cita que vas a cobrar.', 400);
    const posted = command.items;
    if (!Array.isArray(posted) || !posted.length || posted.length > 100 || posted.some(i => !i || typeof i !== 'object')) fail('INVALID_ITEMS', 'Agrega entre 1 y 100 artículos.', 400);
    // Product snapshots are assembled by Inventory, never supplied by the browser.
    const lines = posted.map(({ description, itemKind, quantity, unitPrice, productId, priceVersion, appointmentComponent, serviceId, performedByStaffId }) => ({ description, itemKind, quantity, unitPrice, productId, priceVersion, appointmentComponent, serviceId, performedByStaffId }));
    if (!operationKey) {
      if (command.appointmentCheckout) fail('OPERATION_KEY_REQUIRED', 'El pago de la cita necesita una clave de operación.', 400);
      if (lines.some(i => i.productId)) fail('OPERATION_KEY_REQUIRED', 'Las ventas de catálogo necesitan una clave de operación.', 400);
      let manualEvents = [];
      const result = await unitOfWork.run(async ctx => {
        manualEvents = [];
        ctx = { ...ctx, eventPublisher: { async publish(name, payload) { manualEvents.push({ name, payload }); } } };
        const access = await accessReader.readAccess({ tenantId, actor }, ctx);
        if (!access.capabilities.cash) fail('ACCESS_DENIED', 'Caja no está habilitada.', 403);
        const normalized = lines.map(i => ({ ...i, itemKind: i.itemKind ?? (access.capabilities.services ? 'service' : 'product') }));
        const transaction = await finance.registerManualSale({ tenantId, id: randomUUID(), actor: access.snapshot, access, command, items: normalized, now: clock() }, ctx);
        if (staff.recordSaleCommissions) await staff.recordSaleCommissions({ tenantId, transaction, access }, ctx);
        return { transaction: await repository.sale(tenantId, transaction.id, ctx) };
      }, { isolationLevel: 'Serializable' });
      for (const event of manualEvents) await staff.publishCheckoutCorrection(event);
      return result;
    }
    let checkoutEvents = [], confirmedPayment;
    const result = await inventory.run({ tenantId, actor, operationKey, kind: 'confirm_pos_sale', command }, async state => {
      checkoutEvents = []; confirmedPayment = null;
      const prepared = await inventory.prepareSale(state, lines.map(i => ({ ...i, itemKind: i.itemKind ?? (state.access.capabilities.services ? 'service' : 'product') })));
      if (command.appointmentCheckout) {
        const local = { ...state.ctx, eventPublisher: { async publish(name, payload) { checkoutEvents.push({ name, payload }); } } };
        const { transaction, servicePrice, deferredAppointment } = await finance.registerAppointmentSale({ tenantId, actor: state.access.snapshot, access: state.access, command, items: prepared, now: state.now }, local);
        if (deferredAppointment?.staffId && deferredAppointment.serviceId) {
          await staff.recordDeferredCheckoutCommission({ tenantId, appointmentId: deferredAppointment.id,
            staffId: deferredAppointment.staffId, serviceId: deferredAppointment.serviceId,
            resolvedPrice: servicePrice, priceSource: 'manual_override', completedAt: state.now }, local);
        }
        try { await staff.correctCheckoutCommission({ tenantId, appointmentId: command.appointmentId, servicePrice, actor: state.access.snapshot }, local); }
        catch (error) { if (error instanceof CommissionDayClosedError || error instanceof CommissionInActiveSettlementError) fail('COMMISSION_CONSOLIDATED', error.message, 409); throw error; }
        if (staff.recordSaleCommissions) await staff.recordSaleCommissions({ tenantId, transaction, access: state.access }, local);
        const evidence = await inventory.start(state, 'sale', { resultSaleId: transaction.id });
        await inventory.sellLines(state, transaction.items);
        confirmedPayment = transaction;
        return evidence;
      }
      const saleId = randomUUID();
      const evidence = await inventory.start(state, 'sale', { resultSaleId: saleId });
      const sale = await finance.registerManualSale({ tenantId, id: saleId, actor: state.access.snapshot, access: state.access,
        command, items: prepared, now: state.now }, state.ctx);
      const local = { ...state.ctx, eventPublisher: { async publish(name, payload) { checkoutEvents.push({ name, payload }); } } };
      if (staff.recordSaleCommissions) await staff.recordSaleCommissions({ tenantId, transaction: sale, access: state.access }, local);
      await inventory.sellLines(state, sale.items);
      return evidence;
    });
    if (!result.replayed) {
      for (const event of checkoutEvents) await staff.publishCheckoutCorrection(event);
      if (confirmedPayment) await finance.publishCheckoutPayment(confirmedPayment);
    }
    return result;
  };
}
module.exports = { buildConfirmPosSale };
