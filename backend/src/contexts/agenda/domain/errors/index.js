class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class AppointmentNotFoundError extends DomainError {
  constructor(appointmentId) {
    super(`La cita "${appointmentId}" no existe.`);
  }
}

class InvalidStatusTransitionError extends DomainError {
  constructor(from, to) {
    super(`Transición de estado no permitida: "${from}" → "${to}".`);
  }
}

class UnresolvedPriceError extends DomainError {
  constructor(appointmentId) {
    super(
      `La cita "${appointmentId}" no tiene un precio resuelto. ` +
        `Asigna un precio (manual, de la mascota o del servicio) antes de completarla. ` +
        `El precio cero es válido; el indeterminado no (ADR 007).`
    );
  }
}

module.exports = { DomainError, AppointmentNotFoundError, InvalidStatusTransitionError, UnresolvedPriceError };
