const prisma = require("../../../../lib/prisma");
const { CommissionReaderPort } = require("../../application/ports/commission-reader.port");

class PrismaCommissionReader extends CommissionReaderPort {
  async listByDateRange(tenantId, dateStart, dateEnd) {
    return prisma.commission.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        // Solo comisiones activas cuentan para consolidación (Etapa 4 del Puente, ADR 009).
        status: "active",
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
