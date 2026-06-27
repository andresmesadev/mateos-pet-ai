// Domain service: intent detection and NLP utilities.
// Channel-agnostic — any channel can use these detectors without modification.

// ─── Text utilities ───────────────────────────────────────────────────────────

const normalizeText = (text) => {
  if (typeof text !== "string") return "";
  return text.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
};

const isMissing = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    return n === "" || n === "null" || n === "n/a";
  }
  return false;
};

const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

// ─── Intent pattern sets ──────────────────────────────────────────────────────

const MANAGEMENT_INTENTS = new Set([
  "cancel_appointment",
  "reschedule_appointment",
  "query_appointments",
  "query_medical_history",
]);

const HUMAN_TAKEOVER_PATTERNS = [
  "hablar con lina", "hablar con una persona", "hablar con alguien",
  "quiero hablar", "una persona real", "agente humano", "atencion humana",
  "comunicarme con", "me comunicas con", "necesito hablar",
];

const CANCEL_PATTERNS = [
  "cancelar cita", "cancela mi cita", "quiero cancelar",
  "no puedo ir", "cancelar mi cita",
];

const RESCHEDULE_PATTERNS = [
  "cambiar cita", "reprogramar", "cambiar horario",
  "reagendar", "cambiar la cita", "mover la cita",
];

const QUERY_APPOINTMENTS_PATTERNS = [
  "mi cita", "mis citas", "cuando tengo cita", "cita pendiente",
  "proxima cita", "cual es mi cita", "tengo cita pendiente", "cuando es mi cita",
];

const QUERY_MEDICAL_HISTORY_PATTERNS = [
  "historial medico", "historial de", "que alergias", "que tiene anotado",
  "a que es alergico", "a que es alergica", "cuando fue vacunado",
  "cuando fue vacunada", "que vacunas", "anotado de", "registro medico",
];

const NO_APPOINTMENT_PATTERNS = ["vacuna", "vacunacion", "vacunar", "desparasit"];

// ─── Intent detectors ─────────────────────────────────────────────────────────

const detectCancelIntent = (text, intent) =>
  intent === "cancel_appointment" ||
  CANCEL_PATTERNS.some((p) => normalizeText(text).includes(p));

const detectRescheduleIntent = (text, intent) => {
  if (intent === "reschedule_appointment") return true;
  const n = normalizeText(text);
  if (RESCHEDULE_PATTERNS.some((p) => n.includes(p))) return true;
  return (
    n.includes("otro dia") &&
    (n.includes("cita") || n.includes("reprogram") || n.includes("cambiar"))
  );
};

const detectQueryAppointmentsIntent = (text, intent) =>
  intent === "query_appointments" ||
  QUERY_APPOINTMENTS_PATTERNS.some((p) => normalizeText(text).includes(p));

const detectQueryMedicalHistoryIntent = (text, intent) =>
  intent === "query_medical_history" ||
  QUERY_MEDICAL_HISTORY_PATTERNS.some((p) => normalizeText(text).includes(p));

const detectHumanTakeoverIntent = (text) =>
  HUMAN_TAKEOVER_PATTERNS.some((p) => normalizeText(text).includes(p));

const detectNoAppointmentNeeded = (text) => {
  const n = normalizeText(text);
  return NO_APPOINTMENT_PATTERNS.some((p) => n.includes(p));
};

// ─── Specialized parsers ──────────────────────────────────────────────────────

const parseGroomingService = (text) => {
  const n = normalizeText(text);
  if (n.includes("medicad")) return "Baño medicado";
  if (n.includes("pulga") || n.includes("antipulga")) return "Baño antipulgas";
  if (n.includes("spa")) return "Spa canino/felino";
  if (n.includes("deslan")) return "Deslanado";
  if (n.includes("color")) return "Colorimetría";
  if (n.includes("corte")) return "Baño + corte";
  if (n.includes("bano") || n.includes("bath")) return "Baño básico";
  return null;
};

// Returns true (wants pickup), false (will bring pet), or null (unclear)
const detectDomicilioIntent = (text) => {
  const n = normalizeText(text);
  const wantsPickup =
    n.includes("recoger") || n.includes("recogen") || n.includes("pasen") ||
    n.includes("domicilio") || n.includes("traigan") || n.includes("manden") ||
    n.includes("mando") || n.includes("enviar");
  const willBring =
    n.includes("traigo") || n.includes("llevo") || n.includes("voy yo") ||
    n.includes("presencial") || n.includes("lo llevo") || n.includes("la llevo");
  if (wantsPickup) return true;
  if (willBring) return false;
  if (n.match(/\bsi\b/) || n.includes("yes") || n.includes("dale") || n.includes("quiero")) return true;
  if (n.match(/\bno\b/) || n.includes("nop")) return false;
  return null;
};

// Returns the medical record type to filter by, or null for all records
const resolveMedicalHistoryFilter = (text) => {
  const n = normalizeText(text);
  if (n.includes("alerg")) return "allergy";
  if (n.includes("vacun")) return "vaccine";
  if (n.includes("consult")) return "consultation";
  if (n.includes("nota")) return "note";
  return null;
};

module.exports = {
  normalizeText,
  isMissing,
  capitalize,
  MANAGEMENT_INTENTS,
  HUMAN_TAKEOVER_PATTERNS,
  CANCEL_PATTERNS,
  RESCHEDULE_PATTERNS,
  QUERY_APPOINTMENTS_PATTERNS,
  QUERY_MEDICAL_HISTORY_PATTERNS,
  NO_APPOINTMENT_PATTERNS,
  detectCancelIntent,
  detectRescheduleIntent,
  detectQueryAppointmentsIntent,
  detectQueryMedicalHistoryIntent,
  detectHumanTakeoverIntent,
  detectNoAppointmentNeeded,
  parseGroomingService,
  detectDomicilioIntent,
  resolveMedicalHistoryFilter,
};
