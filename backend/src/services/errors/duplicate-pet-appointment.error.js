const CONSTRAINT = 'appointment_pet_service_day_unique';
class DuplicatePetAppointmentError extends Error {
  constructor() {
    super('Esta mascota ya tiene una cita para el mismo servicio en este día. Revisa Agenda antes de crear otra.');
    this.code = 'DUPLICATE_PET_APPOINTMENT'; this.status = 409;
  }
}
function isDuplicatePetAppointment(error) {
  return error?.code === 'DUPLICATE_PET_APPOINTMENT' ||
    (['P2002', 'P2010', '23505'].includes(error?.code) &&
      JSON.stringify({ message: error.message, meta: error.meta, constraint: error.constraint }).includes(CONSTRAINT));
}
module.exports = { DuplicatePetAppointmentError, isDuplicatePetAppointment };
