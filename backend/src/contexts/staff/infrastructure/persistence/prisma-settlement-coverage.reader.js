const prisma = require("../../../../lib/prisma");

/**
 * Lectura de cobertura de liquidaciones — frontera ADR 009-D4(b):
 * ¿existe una Settlement activa cuyo período cubre este instante para este staff?
 */
class PrismaSettlementCoverageReader {
  async findActiveCovering(staffId, at) {
    return prisma.settlement.findFirst({
      where: {
        staffId,
        status: "active",
        periodStart: { lte: at },
        periodEnd: { gte: at },
      },
    });
  }
}

module.exports = { PrismaSettlementCoverageReader };
