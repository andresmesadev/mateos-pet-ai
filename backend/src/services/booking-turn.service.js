// Input and session guards for the WhatsApp adapter. No persistence or sending.
const { toDateKey, getDecimalHourInTimezone } = require("../lib/timezone");
const { normalizeText } = require("./domain/intent-detector.service");
const { STEPS, BOOKING_STEPS } = require("./domain/booking-steps");

const clearBooking = (session) => ({
  ...session, step: null, pet_name: null, pet_type: null,
  requested_service: null, grooming_service: null,
  reschedule_appointment_id: null,
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

const isFarewellOnly = (text) => {
  const n = normalizeText(text).replace(/[^\p{L}\s]/gu, " ").trim().replace(/\s+/g, " ");
  return /^(?:adios|chao|chau|hasta (?:pronto|luego|manana)|buenas noches)(?: muchas gracias)?$/.test(n);
};

// A name suggested by history is not a selection for this booking.
const selectCurrentPet = (previous, analysis, text) => {
  const next = { ...(analysis || {}) };
  const normalized = normalizeText(text).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const candidate = normalizeText(next.pet_name || "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const mentioned = candidate && (` ${normalized} `).includes(` ${candidate} `);
  if (mentioned && candidate !== normalizeText(previous.pet_name || "") && !/\b(?:perro|perra|gato|gata)\b/.test(normalized)) next.pet_type = null;
  if (!mentioned) {
    next.pet_name = previous.pet_name || null;
    if (!/\b(?:perro|perra|gato|gata)\b/.test(normalized)) next.pet_type = previous.pet_type || null;
  }
  if (!next.pet_name && previous.step === STEPS.AWAITING_PET_NAME &&
      /^[\p{L}][\p{L}\p{N}' -]{1,59}$/u.test(text.trim()) &&
      !/\b(?:si|no|ok|confirmo|gracias|hola|quiero|cita|manana|perro|gato|otra|mascota|cual|nombre)\b/.test(normalized) &&
      !isFarewellOnly(text)) {
    next.pet_name = text.trim();
  }
  return next;
};

const confirmsSelectedPet = (text, petName) => {
  const n = normalizeText(text).replace(/[¡!¿?.,;:]/g, " ").replace(/\s+/g, " ").trim();
  if (!/\b(?:para|mascota|perro|perra|gato|gata|otra|otro)\b/.test(n)) return /^(?:si|ok|okay|confirmo|confirmado|dale|claro|listo|bueno|acepto|perfecto|de acuerdo)(?:\s+(?:si|confirmo|la cita|acepto las? \d+(?::\d+)?(?: am| pm)?))?[.!\s]*$/.test(n);
  const selected = normalizeText(petName || "");
  return Boolean(selected && (` ${n} `).includes(` ${selected} `) && !/\b(?:otra|otro)\b/.test(n));
};

module.exports = { prepareBookingTurn, separateClientAndPet, isAcknowledgementOnly, isFarewellOnly, selectCurrentPet, confirmsSelectedPet };
