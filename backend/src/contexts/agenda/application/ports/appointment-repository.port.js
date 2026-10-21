/**
 * Puerto de persistencia de los comandos Completar Cita y Retirar Cita Errónea.
 */
class AppointmentRepositoryPort {
  async findRemoval(tenantId, appointmentId, ctx) { throw new Error('AppointmentRepositoryPort.findRemoval no implementado'); }
  async lockForRemoval(tenantId, appointmentId, ctx) { throw new Error('AppointmentRepositoryPort.lockForRemoval no implementado'); }
  async hasRemovalDependencies(tenantId, appointmentId, ctx) { throw new Error('AppointmentRepositoryPort.hasRemovalDependencies no implementado'); }
  async removeWithAudit(appointment, audit, ctx) { throw new Error('AppointmentRepositoryPort.removeWithAudit no implementado'); }
  // Devuelve la cita con las relaciones necesarias para resolver su precio
  // (precios de mascota/servicio y cita que cobra el transporte compartido).
  // El adaptador transaccional ofrece lockAndFindById(tenantId, id, ctx)
  // para releer esos datos bajo bloqueo antes de congelar el cobro.
  async findById(tenantId, appointmentId, ctx) {
    throw new Error("AppointmentRepositoryPort.findById no implementado");
  }
  // El profesional y la cita ya están bloqueados por la operación de cierre.
  async assignStaff(tenantId, appointmentId, staffId, ctx) {
    throw new Error('AppointmentRepositoryPort.assignStaff no implementado');
  }

  // resolvedPrice es peluquería; transportPrice opcional se congela separado.
  async markCompleted(appointmentId, endedAt, resolvedPrice, ctx, transportPrice) {
    throw new Error("AppointmentRepositoryPort.markCompleted no implementado");
  }
}

module.exports = { AppointmentRepositoryPort };
