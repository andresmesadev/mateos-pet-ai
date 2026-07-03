/**
 * Puerto de persistencia de citas — solo lo que el comando Completar Cita necesita.
 */
class AppointmentRepositoryPort {
  // Devuelve la cita con las relaciones necesarias para resolver su precio
  // (pet.defaultGroomingPrice, service.basePrice, service.category).
  async findById(tenantId, appointmentId) {
    throw new Error("AppointmentRepositoryPort.findById no implementado");
  }

  async markCompleted(appointmentId, endedAt, ctx) {
    throw new Error("AppointmentRepositoryPort.markCompleted no implementado");
  }
}

module.exports = { AppointmentRepositoryPort };
