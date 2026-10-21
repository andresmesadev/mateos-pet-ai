const prisma = require("../../../../lib/prisma");
const { AppointmentRepositoryPort } = require("../../application/ports/appointment-repository.port");

class PrismaAppointmentRepository extends AppointmentRepositoryPort {
  async findRemoval(tenantId, appointmentId, ctx) {
    return ctx.tx.appointmentRemoval.findFirst({ where: { tenantId, appointmentId } });
  }
  async lockForRemoval(tenantId, appointmentId, ctx) {
    await ctx.tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${appointmentId} AND "tenantId" = ${tenantId} FOR UPDATE`;
    return ctx.tx.appointment.findFirst({ where: { id: appointmentId, tenantId } });
  }
  async hasRemovalDependencies(tenantId, appointmentId, ctx) {
    const tx = ctx.tx;
    const counts = await Promise.all([
      tx.medicalRecord.count({ where: { appointmentId } }),
      tx.transaction.count({ where: { appointmentId } }),
      tx.commission.count({ where: { appointmentId } }),
      tx.inventoryMovement.count({ where: { appointmentId } }),
      tx.petNextAction.count({ where: { sourceAppointmentId: appointmentId } }),
      tx.appointment.count({ where: { transportSharedWithId: appointmentId } }),
    ]);
    return counts.some(Boolean);
  }
  async removeWithAudit(appointment, { actor, reason, removedAt }, ctx) {
    const removal = await ctx.tx.appointmentRemoval.create({ data: {
      appointmentId: appointment.id, tenantId: appointment.tenantId,
      actorId: actor.id, actorName: actor.name, actorRole: actor.role,
      reason, previousStatus: appointment.status, snapshot: JSON.parse(JSON.stringify(appointment)), removedAt,
    } });
    await ctx.tx.appointment.delete({ where: { id: appointment.id, tenantId: appointment.tenantId } });
    return removal;
  }
  async findById(tenantId, appointmentId, ctx) {
    return (ctx?.tx ?? prisma).appointment.findFirst({
      where: { id: appointmentId, ...(tenantId ? { tenantId } : {}) },
      include: {
        pet: { select: { defaultGroomingPrice: true, defaultGroomingWithTransportPrice: true, defaultGroomingTransportPrice: true } },
        transportSharedWith: { select: { id: true, tenantId: true, userId: true, status: true, transportMode: true, transportPrice: true } },
        service: { select: { id: true, basePrice: true, category: { select: { id: true, name: true } },
          priceRules: { where: { active: true, targetType: "pet" }, select: { targetId: true, price: true } },
        } },
      },
    });
  }

  async lockAndFindById(tenantId, appointmentId, ctx) {
    await ctx.tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${appointmentId} AND "tenantId" = ${tenantId} FOR UPDATE`;
    return this.findById(tenantId, appointmentId, ctx);
  }

  async markCompleted(appointmentId, endedAt, resolvedPrice, ctx, transportPrice) {
    const client = ctx?.tx ?? prisma;
    return client.appointment.update({
      where: { id: appointmentId },
      data: { status: "completed", endedAt, finalPrice: resolvedPrice, ...(transportPrice !== undefined ? { transportPrice } : {}) },
    });
  }
  async assignStaff(tenantId, appointmentId, staffId, ctx) {
    await ctx.tx.appointment.update({ where: { id: appointmentId, tenantId }, data: { staffId } });
    return this.findById(tenantId, appointmentId, ctx);
  }
}

module.exports = { PrismaAppointmentRepository };
