/** Shared by human and digital-employee Expense/close commands. */
class PrismaBusinessDayGate {
  async acquire(tenantId, day, ctx) {
    if (!ctx?.tx || !tenantId) throw new Error('Business-day gate requires tenant and transaction');
    const key = JSON.stringify(['expense-close-v1', tenantId, day]);
    // Select an integer rather than PostgreSQL's void return type (Prisma cannot deserialize void).
    await ctx.tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;
  }
}
module.exports = { PrismaBusinessDayGate };
