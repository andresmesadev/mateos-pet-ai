const prisma = require("../../../../lib/prisma");
const { CommissionRepositoryPort } = require("../../application/ports/commission-repository.port");

class PrismaCommissionRepository extends CommissionRepositoryPort {
  async create(data) {
    return prisma.commission.create({ data });
  }

  async listByStaffAndPeriod(staffId, periodStart, periodEnd) {
    return prisma.commission.findMany({
      where: {
        staffId,
        completedAt: { gte: new Date(periodStart), lt: new Date(periodEnd) },
      },
    });
  }
}

module.exports = { PrismaCommissionRepository };
