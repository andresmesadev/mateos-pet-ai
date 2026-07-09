/**
 * Entregable 4.1 (Fase 4) — A6: lanzado cuando el índice único parcial
 * (tenantId, availabilityBucket, date) rechaza una reserva por colisión
 * real, reemplazando la verificación previa no atómica.
 */
class SlotAlreadyBookedError extends Error {
  constructor(details = {}) {
    super("El horario solicitado ya fue reservado");
    this.name = "SlotAlreadyBookedError";
    this.details = details;
  }
}

module.exports = { SlotAlreadyBookedError };
