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
  constructor(appointmentId, reason) {
    super(
      reason || 'Define el valor de la peluquería y confirma su domicilio antes de finalizar la atención.'
    );
  }
}

module.exports = { DomainError, AppointmentNotFoundError, InvalidStatusTransitionError, UnresolvedPriceError };
