const { fail, text, MAX } = require('../domain/policy');
const db = ctx => { if (!ctx?.tx) throw new Error('Inventory requires transactional ctx'); return ctx.tx; };
class PrismaInventoryRepository {
  findProduct(tenantId, id, ctx) { return db(ctx).inventoryProduct.findFirst({ where: { tenantId, id } }); }
  async lockProducts(tenantId, ids, ctx) {
    for (const id of ids) text(id, 'Identificador de producto', 100);
    for (const id of [...new Set(ids)].sort()) {
      const rows = await db(ctx).$queryRaw`SELECT id FROM "InventoryProduct" WHERE "tenantId"=${tenantId} AND id=${id} FOR UPDATE`;
      if (!rows.length) fail('PRODUCT_NOT_FOUND', 'Producto no encontrado.', 404);
    }
  }
  createProduct(data, ctx) { return db(ctx).inventoryProduct.create({ data }); }
  updateProduct(tenantId, id, data, ctx) { return db(ctx).inventoryProduct.update({ where: { tenantId_id: { tenantId, id } }, data }); }
  async bumpStock(tenantId, id, ctx) {
    const p = await this.findProduct(tenantId, id, ctx);
    if (p.stockRevision >= MAX) fail('VERSION_LIMIT', 'El producto alcanzó el límite de revisiones. Consulta a administración.', 409);
    return this.updateProduct(tenantId, id, { stockRevision: { increment: 1 } }, ctx);
  }
  lots(tenantId, productId, ctx) { return db(ctx).inventoryLot.findMany({ where: { tenantId, productId } }); }
  findLot(tenantId, productId, id, ctx) { return db(ctx).inventoryLot.findFirst({ where: { tenantId, productId, id } }); }
  createLot(data, ctx) { return db(ctx).inventoryLot.create({ data }); }
  async changeBalance(tenantId, lot, delta, ctx) {
    const changed = await db(ctx).inventoryLot.updateMany({ where: { tenantId, id: lot.id, balancePhysical: lot.balancePhysical }, data: { balancePhysical: { increment: delta } } });
    if (changed.count !== 1) fail('STOCK_CHANGED', 'Las existencias cambiaron. Actualiza y vuelve a intentarlo.', 409);
  }
  recordMovement(data, ctx) { return db(ctx).inventoryMovement.create({ data }); }
  movements(tenantId, where, ctx) { return db(ctx).inventoryMovement.findMany({ where: { ...where, tenantId }, orderBy: { ordinal: 'asc' } }); }
  async compensatedQuantity(tenantId, sourceMovementId, ctx) { const result = await db(ctx).inventoryMovement.aggregate({ where: { tenantId, sourceMovementId, kind: 'consumption_correction' }, _sum: { quantity: true } }); return result._sum.quantity ?? 0; }
  findOperation(identity, ctx) { return db(ctx).inventoryOperation.findUnique({ where: { tenantId_principalKey_kind_requestKey: identity } }); }
  createOperation(data, ctx) { return db(ctx).inventoryOperation.create({ data }); }
  async lockSale(tenantId, id, ctx) { const rows = await db(ctx).$queryRaw`SELECT id FROM "Transaction" WHERE "tenantId"=${tenantId} AND id=${id} FOR UPDATE`; if (!rows.length) fail('SALE_NOT_FOUND', 'Venta no encontrada.', 404); }
  sale(tenantId, id, ctx) { return db(ctx).transaction.findFirst({ where: { tenantId, id }, include: { items: { include: { inventoryReturn: true } }, user: { select: { id: true, name: true, phone: true } }, pet: { select: { id: true, name: true, type: true } }, appointment: { select: { id: true, date: true, serviceType: true } } } }); }
  attention(tenantId, id, ctx) { return db(ctx).appointment.findFirst({ where: { tenantId, id }, include: { service: { select: { category: { select: { name: true } } } } } }); }
  createReturn(data, ctx) { return db(ctx).inventoryReturnLine.create({ data }); }
}
module.exports = { PrismaInventoryRepository, db };
