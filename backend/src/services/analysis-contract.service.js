// The model extracts fields; it cannot choose persistence IDs or wizard state.
const INTENTS = new Set(["greeting", "schedule_appointment", "cancel_appointment", "reschedule_appointment", "query_appointments", "query_medical_history", "save_medical_info", "ask_info", "other"]);
const SERVICES = new Set(["bath_grooming", "veterinary_consultation", "medication", "general_appointment"]);
const PET_TYPES = new Set(["dog", "cat", "other"]);
const textField = (value, max) => typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null;
const validateAnalysis = value => {
  if (!value || typeof value !== "object" || Array.isArray(value) || !INTENTS.has(value.intent)) return null;
  return { intent: value.intent, pet_type: PET_TYPES.has(value.pet_type) ? value.pet_type : null,
    requested_service: SERVICES.has(value.requested_service) ? value.requested_service : null,
    pet_name: textField(value.pet_name, 60), client_name: textField(value.client_name, 60),
    date: textField(value.date, 120), time: textField(value.time, 60) };
};
module.exports = { validateAnalysis };
