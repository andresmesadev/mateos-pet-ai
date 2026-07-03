const prisma = require("../../../../lib/prisma");
const { CommissionRepositoryPort } = require("../../application/ports/commission-repository.port");

class PrismaCommissionRepository extends CommissionRepositoryPort {
  async create(data, ctx) {
    const client = ctx?.tx ?? prisma;
    return client.commission.create({ data });
  }

  async findById(commissionId) {
    return prisma.commission.findUnique({ where: { id: commissionId } });
  }

  // Solo comisiones activas cuentan para liquidaciones (Etapa 4 del Puente).
  async listByStaffAndPeriod(staffId, periodStart, periodEnd) {
    return prisma.commission.findMany({
      where: {
        staffId,
        status: "active",
        completedAt: { gte: new Date(periodStart), lt: new Date(periodEnd) },
      },
    });
  }

  // ADR 009-D3: anulación + reemplazo, atómicos en una única transacción.
  async voidAndReplace(commissionId, { voidedAt, voidReason, replacement }) {
    return prisma.$transaction(async (tx) => {
      const voided = await tx.commission.update({
        where: { id: commissionId },
        data: { status: "voided", voidedAt, voidReason },
      });
      const created = replacement ? await tx.commission.create({ data: replacement }) : null;
      return { voided, replacement: created };
    });
  }
}

module.exports = { PrismaCommissionRepository };
