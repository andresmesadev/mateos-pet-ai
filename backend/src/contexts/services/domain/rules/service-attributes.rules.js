const { InvalidServiceAttributesError } = require("../errors");

function validateReservationDuration(duration, requiresAppointment) {
  if (typeof requiresAppointment !== "boolean" ||
      (duration != null && (!Number.isInteger(duration) || duration <= 0)) ||
      (requiresAppointment && duration == null)) {
    throw new InvalidServiceAttributesError("Los servicios con cita necesitan duración positiva. Un complemento sin reserva puede dejarla pendiente.");
  }
}

module.exports = { validateReservationDuration };
