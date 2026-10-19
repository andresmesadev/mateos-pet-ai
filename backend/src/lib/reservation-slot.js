// Reception capacity, independent of the full service duration in the catalogue.
const GROOMING_SLOT_MINUTES = 20;
const reservationSlotMinutes = bucket => bucket === 'grooming' ? GROOMING_SLOT_MINUTES : 60;

module.exports = { GROOMING_SLOT_MINUTES, reservationSlotMinutes };
