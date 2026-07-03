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

  async findActiveByAppointment(appointmentId, origin) {
    return prisma.transaction.findFirst({
      where: { appointmentId, origin, status: "active" },
    });
  }

  // ADR 007-D3(a): el POS liquida el cobro de sistema — nunca su monto.
  async settle(transactionId, { paymentMethod, notes }) {
    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
        ...(notes !== undefined ? { notes } : {}),
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
