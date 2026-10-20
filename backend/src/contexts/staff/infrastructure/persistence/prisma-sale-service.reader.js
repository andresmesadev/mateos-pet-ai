class PrismaSaleServiceReader {
  async capabilities(staffId, serviceId, ctx) {
    return ctx.tx.staffCapability.findMany({ where: { staffId, serviceId, active: true } });
  }
  async service(tenantId, id, ctx) {
    return ctx.tx.service.findFirst({ where: { id, tenantId }, select: { active: true } });
  }
  async lockItem(tenantId, id, ctx) {
    await ctx.tx.$queryRaw`SELECT i.id FROM "TransactionItem" i JOIN "Transaction" t ON t.id = i."transactionId" WHERE i.id = ${id} AND t."tenantId" = ${tenantId} FOR UPDATE OF t, i`;
    return ctx.tx.transactionItem.findFirst({ where: { id, transaction: { tenantId } }, include: { transaction: true } });
  }
}
module.exports = { PrismaSaleServiceReader };
