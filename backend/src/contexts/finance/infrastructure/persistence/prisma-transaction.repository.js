const prisma = require("../../../../lib/prisma");
const { TransactionRepositoryPort } = require("../../application/ports/transaction-repository.port");

class PrismaTransactionRepository extends TransactionRepositoryPort {
  async createSystemCharge({ tenantId, appointmentId, total, paidAt }, ctx) {
    const client = ctx?.tx ?? prisma;
    return client.transaction.create({
      data: {
        tenantId: tenantId ?? null,
        appointmentId,
        total,
        paidAt,
        origin: "system_appointment_completed",
      },
    });
  }

  // Solo el ingreso ACTIVO cuenta (Etapa 4 del Puente): las anuladas quedan
  // para trazabilidad, nunca para consolidación.
  async listByDateRange(tenantId, dateStart, dateEnd) {
    return prisma.transaction.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: "active",
        paidAt: { gte: dateStart, lt: dateEnd },
      },
    });
  }

  async findById(transactionId) {
    return prisma.transaction.findUnique({ where: { id: transactionId } });
  }

  async findActiveByAppointment(appointmentId, origin, ctx) {
    return (ctx?.tx ?? prisma).transaction.findFirst({
      where: { appointmentId, origin, status: "active" },
    });
  }

  async createManualSale(data, ctx) {
    if (!ctx?.tx) throw new Error("Manual sale requires a transaction");
    return ctx.tx.transaction.create({ data, include: { items: true } });
  }

  // ADR 007-D3(a): el POS liquida el cobro de sistema — nunca su monto.
  async settle(transactionId, { paymentMethod, notes, recordedBy }) {
    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(recordedBy ? { recordedActorId: recordedBy.id, recordedActorName: recordedBy.name, recordedActorRole: recordedBy.role } : {}),
      },
    });
  }

  async void(transactionId, { voidedAt, voidReason }) {
    return prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "voided", voidedAt, voidReason },
    });
  }
}

module.exports = { PrismaTransactionRepository };
