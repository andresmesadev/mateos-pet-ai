const prisma = require("../../../../lib/prisma");
const { FinancialPeriodRepositoryPort } = require("../../application/ports/financial-period-repository.port");

class PrismaFinancialPeriodRepository extends FinancialPeriodRepositoryPort {
  async findByRange(tenantId, periodStart, periodEnd) {
    return prisma.financialPeriod.findFirst({
      where: { ...(tenantId ? { tenantId } : {}), periodStart, periodEnd },
    });
  }

  async create(data, ctx) {
    const client = ctx?.tx ?? prisma;
    try {
      return await client.financialPeriod.create({ data });
    } catch (err) {
      if (err?.code === "P2002") {
        const wrapped = new Error("Violación del índice único de FinancialPeriod");
        wrapped.code = "UNIQUE_FINANCIAL_PERIOD_VIOLATION";
        throw wrapped;
      }
      throw err;
    }
  }
}

module.exports = { PrismaFinancialPeriodRepository };
