const prisma = require("../../../../lib/prisma");
const { TransactionRepositoryPort } = require("../../application/ports/transaction-repository.port");

class PrismaTransactionRepository extends TransactionRepositoryPort {
  async createSystemCharge({ tenantId, appointmentId, total, paidAt }, ctx) {
    const client = ctx?.tx ?? prisma;
    const appointment = await client.appointment.findFirst({ where: { id: appointmentId, tenantId: tenantId ?? null }, select: { userId: true, petId: true } });
    return client.transaction.create({
      data: {
        tenantId: tenantId ?? null,
        appointmentId,
        total,
        paidAt,
        userId: appointment?.userId ?? null,
        petId: appointment?.petId ?? null,
        origin: "system_appointment_completed",
      },
    });
  }

  // Solo el ingreso ACTIVO cuenta (Etapa 4 del Puente): las anuladas quedan
  // para trazabilidad, nunca para consolidación.
  async listByDateRange(tenantId, dateStart, dateEnd, ctx) {
    return (ctx?.tx ?? prisma).transaction.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: "active",
        paidAt: { gte: dateStart, lt: dateEnd },
      },
    });
  }

  async findById(transactionId, ctx) {
    return (ctx?.tx ?? prisma).transaction.findUnique({ where: { id: transactionId } });
  }

  async findActiveByAppointment(appointmentId, origin, ctx) {
    return (ctx?.tx ?? prisma).transaction.findFirst({
      where: { appointmentId, origin, status: "active" },
    });
  }

  async lockByAppointment(tenantId, appointmentId, ctx) {
    // Serialize checkout even when an unvalued visit has no Transaction yet.
    await ctx.tx.$queryRaw`SELECT id FROM "Appointment" WHERE "tenantId" = ${tenantId} AND id = ${appointmentId} FOR UPDATE`;
    await ctx.tx.$queryRaw`SELECT id FROM "Transaction" WHERE "tenantId" = ${tenantId} AND "appointmentId" = ${appointmentId} AND origin = 'system_appointment_completed' AND status = 'active' FOR UPDATE`;
    return ctx.tx.transaction.findFirst({ where: { tenantId, appointmentId, origin: 'system_appointment_completed', status: 'active' } });
  }

  async findDeferredAppointment(tenantId, appointmentId, ctx) {
    const { isDeferredAppointmentPrice } = require('../../../../services/domain/price-resolver.service');
    const row = await ctx.tx.appointment.findFirst({ where: { tenantId, id: appointmentId }, include: { service: { select: { category: { select: { name: true } } } } } });
    return row && isDeferredAppointmentPrice(row) ? row : null;
  }

  async valueDeferredAppointment(tenantId, appointmentId, servicePrice, ctx) {
    await ctx.tx.appointment.update({ where: { id: appointmentId, tenantId, status: 'completed', finalPrice: null }, data: { finalPrice: servicePrice } });
  }

  async createManualSale(data, ctx) {
    if (!ctx?.tx) throw new Error("Manual sale requires a transaction");
    return ctx.tx.transaction.create({ data, include: { items: true } });
  }

  async checkoutPending(id, { items, ...data }, ctx) {
    if (!ctx?.tx) throw new Error('Appointment checkout requires transaction');
    return ctx.tx.transaction.update({ where: { id }, data: { ...data, items: { deleteMany: {}, create: items } }, include: { items: true } });
  }

  // ADR 007-D3(a): el POS liquida el cobro de sistema — nunca su monto.
  async settle(transactionId, { paymentMethod, notes, recordedBy, paidAt }, ctx) {
    return (ctx?.tx ?? prisma).transaction.update({
      where: { id: transactionId },
      data: {
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(paidAt !== undefined ? { paidAt } : {}),
        ...(recordedBy ? { recordedActorId: recordedBy.id, recordedActorName: recordedBy.name, recordedActorRole: recordedBy.role } : {}),
      },
    });
  }

  async void(transactionId, { voidedAt, voidReason }, ctx) {
    return (ctx?.tx ?? prisma).transaction.update({
      where: { id: transactionId },
      data: { status: "voided", voidedAt, voidReason },
    });
  }
}

module.exports = { PrismaTransactionRepository };
