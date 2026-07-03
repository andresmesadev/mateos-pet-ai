const prisma = require("../../../../lib/prisma");
const { DailyCloseRepositoryPort } = require("../../application/ports/daily-close-repository.port");

const UNIQUE_INDEX_NAME = "DailyClose_tenantId_date_key";

function isUniqueDateViolation(err) {
  const target = err?.meta?.target;
  return (
    err?.code === "P2002" &&
    (target === UNIQUE_INDEX_NAME || (Array.isArray(target) && target.includes("date")))
  );
}

class PrismaDailyCloseRepository extends DailyCloseRepositoryPort {
  async findByDate(tenantId, date) {
    return prisma.dailyClose.findFirst({
      where: { ...(tenantId ? { tenantId } : {}), date },
    });
  }

  async create(data) {
    try {
      return await prisma.dailyClose.create({ data });
    } catch (err) {
      if (isUniqueDateViolation(err)) {
        const wrapped = new Error("Violación del índice único de DailyClose");
        wrapped.code = "UNIQUE_DAILY_CLOSE_VIOLATION";
        throw wrapped;
      }
      throw err;
    }
  }

  async listByDateRange(tenantId, dateStart, dateEnd) {
    return prisma.dailyClose.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        date: { gte: dateStart, lte: dateEnd },
      },
      orderBy: { date: "asc" },
    });
  }

  async assignToPeriod(dailyCloseIds, financialPeriodId, ctx) {
    const client = ctx?.tx ?? prisma;
    const result = await client.dailyClose.updateMany({
      where: { id: { in: dailyCloseIds }, financialPeriodId: null },
      data: { financialPeriodId },
    });
    return result.count;
  }
}

module.exports = { PrismaDailyCloseRepository };
