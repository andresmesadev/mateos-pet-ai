const { randomUUID } = require('node:crypto');
const { fail } = require('../../../contexts/inventory/domain/policy');
function buildConfirmPosSale({ inventory, finance, repository, accessReader, unitOfWork, clock = () => new Date() }) {
  return async function confirm({ tenantId, actor, operationKey, command }) {
    if (!command || command.tenantId !== undefined || command.actor !== undefined || command.principalKey !== undefined) fail('INVALID_IDENTITY', 'La identidad y el establecimiento se obtienen de la sesión.', 400);
    const posted = command.items;
    if (!Array.isArray(posted) || !posted.length || posted.length > 100 || posted.some(i => !i || typeof i !== 'object')) fail('INVALID_ITEMS', 'Agrega entre 1 y 100 artículos.', 400);
    // Product snapshots are assembled by Inventory, never supplied by the browser.
    const lines = posted.map(({ description, itemKind, quantity, unitPrice, productId, priceVersion }) => ({ description, itemKind, quantity, unitPrice, productId, priceVersion }));
    if (!operationKey) {
      if (lines.some(i => i.productId)) fail('OPERATION_KEY_REQUIRED', 'Las ventas de catálogo necesitan una clave de operación.', 400);
      return unitOfWork.run(async ctx => {
        const access = await accessReader.readAccess({ tenantId, actor }, ctx);
        if (!access.capabilities.cash) fail('ACCESS_DENIED', 'Caja no está habilitada.', 403);
        const normalized = lines.map(i => ({ ...i, itemKind: i.itemKind ?? (access.capabilities.services ? 'service' : 'product') }));
        const transaction = await finance.registerManualSale({ tenantId, id: randomUUID(), actor: access.snapshot, access, command, items: normalized, now: clock() }, ctx);
        return { transaction: await repository.sale(tenantId, transaction.id, ctx) };
      }, { isolationLevel: 'Serializable' });
    }
    return inventory.run({ tenantId, actor, operationKey, kind: 'confirm_pos_sale', command }, async state => {
      const prepared = await inventory.prepareSale(state, lines.map(i => ({ ...i, itemKind: i.itemKind ?? (state.access.capabilities.services ? 'service' : 'product') })));
      const saleId = randomUUID();
      const evidence = await inventory.start(state, 'sale', { resultSaleId: saleId });
      const sale = await finance.registerManualSale({ tenantId, id: saleId, actor: state.access.snapshot, access: state.access,
        command, items: prepared, now: state.now }, state.ctx);
      await inventory.sellLines(state, sale.items);
      return evidence;
    });
  };
}
module.exports = { buildConfirmPosSale };
