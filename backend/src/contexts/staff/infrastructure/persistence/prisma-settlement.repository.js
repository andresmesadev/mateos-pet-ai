const prisma = require("../../../../lib/prisma");
const { SettlementRepositoryPort } = require("../../application/ports/settlement-repository.port");

const UNIQUE_PARTIAL_INDEX_NAME = "Settlement_active_period_unique";

function isUniqueActivePeriodViolation(err) {
  const message = String(err?.message || "");
  const target = err?.meta?.target;
  return (
    message.includes(UNIQUE_PARTIAL_INDEX_NAME) ||
    (Array.isArray(target) && target.includes(UNIQUE_PARTIAL_INDEX_NAME)) ||
    target === UNIQUE_PARTIAL_INDEX_NAME
  );
}

class PrismaSettlementRepository extends SettlementRepositoryPort {
  async findActiveByStaffAndPeriod(staffId, periodStart, periodEnd) {
    return prisma.settlement.findFirst({
      where: { staffId, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd), status: "active" },
    });
  }

  async create(data) {
    try {
      return await prisma.settlement.create({ data });
    } catch (err) {
      if (isUniqueActivePeriodViolation(err)) {
        const wrapped = new Error("Violación del índice único parcial de Settlement");
        wrapped.code = "UNIQUE_SETTLEMENT_VIOLATION";
        throw wrapped;
      }
      throw err;
    }
  }

  async list({ tenantId, staffId, periodStart, periodEnd }) {
    return prisma.settlement.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(staffId ? { staffId } : {}),
        ...(periodStart ? { periodStart: { gte: new Date(periodStart) } } : {}),
        ...(periodEnd ? { periodEnd: { lte: new Date(periodEnd) } } : {}),
      },
      orderBy: { periodStart: "desc" },
    });
  }
}

module.exports = { PrismaSettlementRepository };
