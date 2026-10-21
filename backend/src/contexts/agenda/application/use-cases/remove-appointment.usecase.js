class AppointmentRemovalError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; this.code = 'APPOINTMENT_REMOVAL'; }
}
function createRemoveAppointmentUseCase({ repository, unitOfWork, clock = () => new Date() }) {
  return async ({ tenantId, appointmentId, actor, reason }) => {
    if (!tenantId || !appointmentId) throw new AppointmentRemovalError('Cita no encontrada.', 404);
    if (!actor?.id || !actor.name || !['admin', 'receptionist'].includes(actor.role)) throw new AppointmentRemovalError('No tienes permiso para eliminar citas.', 403);
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) throw new AppointmentRemovalError('Escribe el motivo de la eliminación (máximo 500 caracteres).', 400);
    return unitOfWork.run(async ctx => {
      const previous = await repository.findRemoval(tenantId, appointmentId, ctx);
      if (previous) return { id: appointmentId, removed: true, removalId: previous.id, replayed: true };
      const appointment = await repository.lockForRemoval(tenantId, appointmentId, ctx);
      if (!appointment) {
        const retried = await repository.findRemoval(tenantId, appointmentId, ctx);
        if (retried) return { id: appointmentId, removed: true, removalId: retried.id, replayed: true };
        throw new AppointmentRemovalError('Cita no encontrada.', 404);
      }
      if (!['pending', 'confirmed', 'arrived', 'in_progress', 'cancelled', 'no_show'].includes(appointment.status) || appointment.endedAt || appointment.groomingNotes || appointment.groomingNotesUpdatedAt || appointment.groomingDeliveredAt || await repository.hasRemovalDependencies(tenantId, appointmentId, ctx)) {
        throw new AppointmentRemovalError('Esta cita tiene atención o registros asociados. No se puede eliminar; conserva su historial y revisa la corrección con administración.');
      }
      const removal = await repository.removeWithAudit(appointment, { actor, reason: reason.trim(), removedAt: clock() }, ctx);
      return { id: appointmentId, removed: true, removalId: removal.id, calendarAppointment: appointment };
    });
  };
}
module.exports = { createRemoveAppointmentUseCase, AppointmentRemovalError };
