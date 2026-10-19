class PrismaStaffFinanceGate {
  async acquire(tenantId, staffId, ctx) {
    if (!ctx?.tx || !tenantId || !staffId) throw new Error('Staff finance gate requires identity and transaction');
    const key = JSON.stringify(['staff-finance-v1', tenantId, staffId]);
    await ctx.tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;
  }
}
module.exports = { PrismaStaffFinanceGate };
