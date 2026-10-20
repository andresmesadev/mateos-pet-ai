const { InvalidServiceAttributesError } = require("../errors");

function validateReservationDuration(duration, requiresAppointment) {
  if (typeof requiresAppointment !== "boolean" ||
      (duration != null && (!Number.isInteger(duration) || duration <= 0)) ||
      (requiresAppointment && duration == null)) {
    throw new InvalidServiceAttributesError("Los servicios con cita necesitan duración positiva. Un complemento sin reserva puede dejarla pendiente.");
  }
}

function validateServiceSplit(value) {
  if (value !== undefined && typeof value !== 'boolean') throw new InvalidServiceAttributesError('Indica si el servicio reparte porcentaje o es directo.');
}

module.exports = { validateReservationDuration, validateServiceSplit };
