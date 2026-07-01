const prisma = require("../../../../lib/prisma");
const { CommissionReaderPort } = require("../../application/ports/commission-reader.port");

class PrismaCommissionReader extends CommissionReaderPort {
  async listByDateRange(tenantId, dateStart, dateEnd) {
    return prisma.commission.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        completedAt: { gte: dateStart, lt: dateEnd },
      },
      select: {
        staffId: true,
        resolvedPrice: true,
        staffShare: true,
        businessShare: true,
        completedAt: true,
        appointmentId: true,
      },
    });
  }
}

module.exports = { PrismaCommissionReader };
