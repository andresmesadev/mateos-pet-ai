// Input and session guards for the WhatsApp adapter. No persistence or sending.
const { toDateKey, getDecimalHourInTimezone } = require("../lib/timezone");
const { normalizeText } = require("./domain/intent-detector.service");
const { STEPS, BOOKING_STEPS } = require("./domain/booking-steps");

const clearBooking = (session) => ({
  ...session, step: null, pet_name: null, pet_type: null,
  requested_service: null, grooming_service: null,
  scheduling_date_key: null, scheduling_hour: null, date: null, time: null,
  domicilio: null, domicilio_address: null,
});

const prepareBookingTurn = (session = {}, text = "", now = new Date(), slot = {}) => {
  const normalized = normalizeText(text);
  const freshRequest = /\b(?:quiero|necesito|quisiera|deseo|agendar|reservar)\b.*\b(?:cita|agendar|reservar)\b/.test(normalized);
  const oldDate = session.scheduling_date_key;
  const today = toDateKey(now);
  const expired = BOOKING_STEPS.has(session.step) && oldDate && (oldDate < today ||
    (oldDate === today && session.scheduling_hour != null &&
      Number(session.scheduling_hour) <= getDecimalHourInTimezone(now)));
  let previous = session;
  if (session.step === STEPS.COMPLETED || expired || (freshRequest && (oldDate || session.requested_service))) {
    previous = clearBooking(session);
  } else if (oldDate && ((slot.dateKey && slot.dateKey !== oldDate) ||
    (slot.hour != null && Number(slot.hour) !== Number(session.scheduling_hour)))) {
    // Changing an offered slot invalidates its confirmation and pickup steps.
    previous = { ...session, step: null, scheduling_date_key: null, scheduling_hour: null,
      ...(slot.dateText ? { date: slot.dateText } : {}),
      ...(slot.timeText ? { time: slot.timeText } : {}),
      domicilio: null, domicilio_address: null };
  }
  return { previous, freshRequest };
};

const separateClientAndPet = (previous, analysis, text) => {
  const next = { ...(analysis || {}) };
  let session = previous;
  const normalized = normalizeText(text);
  const explicitPet = /\b(?:mi\s+)?(?:perro|perra|gato|gata|mascota)\s+se\s+llama\b/.test(normalized);
  const namingClient = previous.step === STEPS.AWAITING_CLIENT_NAME ||
    /\b(?:mi nombre es|me llamo|es mi nombre)\b/.test(normalized);
  if (namingClient && !explicitPet) {
    // An answer to "who am I speaking with?" is not a pet declaration.
    next.pet_name = null;
    if (previous.step === STEPS.AWAITING_CLIENT_NAME ||
      normalizeText(previous.pet_name || "") === normalizeText(next.client_name || previous.client_name || "")) {
      session = { ...previous, pet_name: null };
    }
  }
  return { previous: session, analysis: next };
};

const isAcknowledgementOnly = (text) => {
  const n = normalizeText(text).replace(/[^\p{L}\s]/gu, " ").trim().replace(/\s+/g, " ");
  return /^(?:(?:muchas|mil) )?gracias(?: por (?:todo|tu ayuda|la ayuda|la informacion))?$/.test(n);
};

module.exports = { prepareBookingTurn, separateClientAndPet, isAcknowledgementOnly };
