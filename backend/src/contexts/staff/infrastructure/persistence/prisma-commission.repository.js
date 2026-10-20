const prisma = require("../../../../lib/prisma");
const { CommissionRepositoryPort } = require("../../application/ports/commission-repository.port");

class PrismaCommissionRepository extends CommissionRepositoryPort {
  async listByTransaction(tenantId, transactionId, ctx) {
    return ctx.tx.commission.findMany({ where: { tenantId, status: 'active', transactionItem: { transactionId, transaction: { tenantId } } }, orderBy: [{ staffId: 'asc' }, { id: 'asc' }] });
  }
  async findByItem(tenantId, transactionItemId, ctx) {
    return (ctx?.tx ?? prisma).commission.findFirst({ where: { tenantId, transactionItemId, status: 'active' } });
  }
  async create(data, ctx) {
    const client = ctx?.tx ?? prisma;
    return client.commission.create({ data });
  }

  async findById(commissionId, ctx) {
    return (ctx?.tx ?? prisma).commission.findUnique({ where: { id: commissionId } });
  }

  async lockByAppointment(tenantId, appointmentId, ctx) {
    await ctx.tx.$queryRaw`SELECT id FROM "Commission" WHERE "tenantId" = ${tenantId} AND "appointmentId" = ${appointmentId} AND status = 'active' FOR UPDATE`;
    return ctx.tx.commission.findFirst({ where: { tenantId, appointmentId, status: 'active' } });
  }

  // Solo comisiones activas cuentan para liquidaciones (Etapa 4 del Puente).
  async listByStaffAndPeriod(staffId, periodStart, periodEnd, ctx) {
    return (ctx?.tx ?? prisma).commission.findMany({
      where: {
        staffId,
        status: "active",
        completedAt: { gte: new Date(periodStart), lt: new Date(periodEnd) },
      },
    });
  }

  // ADR 009-D3: anulación + reemplazo, atómicos en una única transacción.
  async voidAndReplace(commissionId, { voidedAt, voidReason, replacement }, ctx) {
    const execute = async (tx) => {
      const voided = await tx.commission.update({
        where: { id: commissionId },
        data: { status: "voided", voidedAt, voidReason },
      });
      const created = replacement ? await tx.commission.create({ data: replacement }) : null;
      return { voided, replacement: created };
    };
    return ctx?.tx ? execute(ctx.tx) : prisma.$transaction(execute);
  }
}

module.exports = { PrismaCommissionRepository };
