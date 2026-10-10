// Conversational protocol: interpretation is never authorization to mutate a booking.
const { normalizeText } = require("./domain/intent-detector.service");

const isConfirmationMessage = (text) => {
  const n = normalizeText(text).replace(/[¡!¿?.,;:]/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(?:no|nop|pero|quizas|tal vez|todavia|necesito|cuanto|precio|costo|duda|otra|otro|prefiero|cambiar)\b/.test(n)) return false;
  return /^(?:si|ok|okay|perfecto|confirmo|confirmar|confirmado|dale|claro|de acuerdo|listo|bueno|acepto)(?:\s|$)/.test(n);
};

const isPickupAddress = (text) => {
  const n = normalizeText(text);
  if (n.length < 8 || /\b(?:no se|todavia|no tengo|despues|luego|cancel|confirm|cita|quiero|prefiero)\b/.test(n) || /[?¿]/.test(text)) return false;
  return /\d/.test(n) || /\b(?:vereda|finca|barrio|edificio|conjunto|urbanizacion)\b/.test(n);
};

const isAvailabilityQuestion = (text) => {
  const n = normalizeText(text);
  return /\b(?:disponib\w*|hay|tienes|tienen|puede|pueden|cupo|turno|para hoy|para manana|otra hora|otro dia)\b/.test(n) &&
    !/\b(?:mi cita|mis citas|cita agendada|cita confirmada|cita pendiente)\b/.test(n);
};

const classifyManagementRequest = (text, intent, session = {}) => {
  const n = normalizeText(text);
  const drafting = Boolean(session.requested_service || session.scheduling_date_key);
  if (/\bno\b.*\b(?:cancel|anul|reprogram)/.test(n)) return null;
  if (/\b(?:cancel\w*|anul\w*)\b/.test(n) && !/\bno\s+(?:cancel|anul)/.test(n)) return "cancel_appointment";
  if (/\b(?:reprogram\w*|reagend\w*|mover (?:mi |la )?cita|cambiar (?:mi |la )?cita)\b/.test(n)) return "reschedule_appointment";
  if (/\b(?:mis citas|cuando (?:es|tengo) (?:mi )?cita|cual es mi cita|cita pendiente|cita agendada|para quien (?:es|era)|de quien (?:es|era))\b/.test(n)) return "query_appointments";
  if (drafting) return null;
  if (/\b(?:agendar|reservar|quiero|necesito)\b/.test(n) && /\bcita\b/.test(n)) return null;
  if (!drafting && ["query_appointments", "cancel_appointment", "reschedule_appointment"].includes(intent)) return intent;
  return null;
};

module.exports = { isConfirmationMessage, isPickupAddress, isAvailabilityQuestion, classifyManagementRequest };
