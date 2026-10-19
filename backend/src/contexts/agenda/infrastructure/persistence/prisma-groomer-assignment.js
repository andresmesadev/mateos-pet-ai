const { uniqueGroomer, lockStaff, assertStaffAssignment, StaffUnavailableError } = require('../../../../services/staff-scheduling.service');
const { serviceModule } = require('../../../../services/dashboard-access.service');
class PrismaGroomerAssignment {
  validateSnapshot(before, after) {
    if (before.serviceId !== after.serviceId || before.serviceType !== after.serviceType || new Date(before.date).getTime() !== new Date(after.date).getTime()) throw new StaffUnavailableError('La cita cambió durante la asignación. Actualiza antes de finalizar.');
  }
  async resolve(appointment, actingStaffId, ctx) {
    if (appointment.staffId || serviceModule(appointment) !== 'grooming') return appointment.staffId ?? null;
    const args = { tenantId: appointment.tenantId, date: appointment.date, serviceId: appointment.serviceId, serviceType: appointment.serviceType, appointmentId: appointment.id };
    if (!actingStaffId) return uniqueGroomer(ctx.tx, args, true);
    await lockStaff(ctx.tx, actingStaffId);
    const service = appointment.serviceId ? await ctx.tx.service.findFirst({ where: { id: appointment.serviceId, tenantId: appointment.tenantId }, include: { category: true } }) : null;
    await assertStaffAssignment(ctx.tx, { ...args, service, staffId: actingStaffId });
    return actingStaffId;
  }
}
module.exports = { PrismaGroomerAssignment };
