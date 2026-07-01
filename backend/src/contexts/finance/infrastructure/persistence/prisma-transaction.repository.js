const prisma = require("../../../../lib/prisma");
const { TransactionRepositoryPort } = require("../../application/ports/transaction-repository.port");

class PrismaTransactionRepository extends TransactionRepositoryPort {
  async createSystemCharge({ tenantId, appointmentId, total, paidAt }) {
    return prisma.transaction.create({
      data: {
        tenantId: tenantId ?? null,
        appointmentId,
        total,
        paidAt,
        origin: "system_appointment_completed",
      },
    });
  }

  async listByDateRange(tenantId, dateStart, dateEnd) {
    return prisma.transaction.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        paidAt: { gte: dateStart, lt: dateEnd },
      },
    });
  }
}

module.exports = { PrismaTransactionRepository };
