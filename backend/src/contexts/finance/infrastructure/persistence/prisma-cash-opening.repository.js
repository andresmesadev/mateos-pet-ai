const prisma = require('../../../../lib/prisma');
const { CashOpeningRepositoryPort } = require('../../application/ports/cash-opening-repository.port');
class PrismaCashOpeningRepository extends CashOpeningRepositoryPort {
  async findByDate(tenantId, date, ctx) { return (ctx?.tx ?? prisma).cashOpening.findUnique({ where: { tenantId_date: { tenantId, date } } }); }
  async previousSuggestion(tenantId, date, ctx) {
    const db = ctx?.tx ?? prisma;
    const close = await db.dailyClose.findFirst({ where: { tenantId, date: { lt: date } }, orderBy: { date: 'desc' } });
    if (!close || close.retainedCashAmount == null) return null;
    const intervening = await db.cashOpening.findFirst({ where: { tenantId, date: { gt: close.date, lt: date } } });
    if (intervening) return null;
    return { id: close.id, date: close.date.toISOString().slice(0, 10), amount: Number(close.retainedCashAmount) };
  }
  async save(data, ctx) {
    const { tenantId, date, ...values } = data;
    return ctx.tx.cashOpening.upsert({ where: { tenantId_date: { tenantId, date } }, create: data, update: values });
  }
}
module.exports = { PrismaCashOpeningRepository };
