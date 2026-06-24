const STEPS = {
  AWAITING_PET_NAME: "awaiting_pet_name",
  AWAITING_PET_TYPE: "awaiting_pet_type",
  // Grooming: ofrecer slot → domicilio → (dirección) → confirmar
  AWAITING_GROOMING_SLOT_CONFIRM: "awaiting_grooming_slot_confirm",
  AWAITING_DOMICILIO: "awaiting_domicilio",
  AWAITING_DOMICILIO_ADDRESS: "awaiting_domicilio_address",
  // Veterinaria
  AWAITING_DATE_TIME: "awaiting_date_time",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  COMPLETED: "completed",
};

const scheduling = require("./scheduling.service");
const { findNextAvailableGroomingSlot } = require("./availability-db.service");
const { generateReply: generateReplyWithAI } = require("./openai.service");
const { findPetByNameAndOwner, getUserPets } = require("./pet.service");
const { detectMedicalInfo } = require("./medical-detection.service");
const {
  createRecord,
  recordExists,
  getRecordsByPet,
  getRecordsByType,
  formatRecordsForWhatsApp,
} = require("./medical-record.service");
const {
  cancelAppointment,
  getUserAppointments,
  mapDbServiceTypeToSession,
  formatAppointmentDateLabel,
  formatAppointmentListLine,
} = require("./appointment.service");

// ─── Patrones de detección ────────────────────────────────────────────────────

const MANAGEMENT_INTENTS = new Set([
  "cancel_appointment",
  "reschedule_appointment",
  "query_appointments",
  "query_medical_history",
]);

const BOOKING_STEPS = new Set([
  STEPS.AWAITING_PET_NAME,
  STEPS.AWAITING_PET_TYPE,
  STEPS.AWAITING_GROOMING_SLOT_CONFIRM,
  STEPS.AWAITING_DOMICILIO,
  STEPS.AWAITING_DOMICILIO_ADDRESS,
  STEPS.AWAITING_DATE_TIME,
  STEPS.AWAITING_CONFIRMATION,
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

// ─── Helpers de texto ─────────────────────────────────────────────────────────

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

const confirmationKeywords = [
  "si", "ok", "perfecto", "confirmar", "confirmo", "dale",
  "claro", "de acuerdo", "confirmado", "listo", "bueno",
];

const isConfirmationMessage = (text) => {
  const n = normalizeText(text);
  if (!n) return false;
  return confirmationKeywords.some((k) => n.includes(normalizeText(k)));
};

const getPetLabel = (petType) => {
  if (petType === "dog") return "perrito";
  if (petType === "cat") return "gatito";
  return "mascota";
};

const getPetEmoji = (petType) => {
  if (petType === "dog") return "🐶";
  if (petType === "cat") return "🐱";
  return "🐾";
};

const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

// ─── Detección de intenciones ─────────────────────────────────────────────────

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

// ─── Parsers de wizard ────────────────────────────────────────────────────────

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

// Detecta si el usuario quiere domicilio (true), lo trae (false), o no está claro (null)
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
  // fallback: yes/no
  if (n.match(/\bsi\b/) || n.includes("yes") || n.includes("dale") || n.includes("quiero")) return true;
  if (n.match(/\bno\b/) || n.includes("nop")) return false;
  return null;
};

const resolveMedicalHistoryFilter = (text) => {
  const n = normalizeText(text);
  if (n.includes("alerg")) return "allergy";
  if (n.includes("vacun")) return "vaccine";
  if (n.includes("consult")) return "consultation";
  if (n.includes("nota")) return "note";
  return null;
};

// ─── Handlers de gestión ──────────────────────────────────────────────────────

const clearSchedulingPatch = () => ({
  scheduling_date_key: undefined,
  scheduling_hour: undefined,
  date: undefined,
  time: undefined,
});

const buildRescheduleSessionPatch = (cancelled, session = {}) => {
  const patch = { ...clearSchedulingPatch(), step: STEPS.AWAITING_DATE_TIME };
  if (cancelled) {
    patch.pet_name = cancelled.petName;
    patch.pet_type = cancelled.petType;
    patch.requested_service =
      mapDbServiceTypeToSession(cancelled.serviceType) ?? session.requested_service;
  } else {
    if (!isMissing(session.pet_name)) patch.pet_name = session.pet_name;
    if (!isMissing(session.pet_type)) patch.pet_type = session.pet_type;
    if (!isMissing(session.requested_service)) patch.requested_service = session.requested_service;
  }
  return patch;
};

const handleCancellation = async (userId) => {
  if (!userId) {
    return { reply: "No tienes citas activas por cancelar 🐾", step: null, sessionPatch: clearSchedulingPatch(), forceRuleReply: true };
  }
  try {
    const cancelled = await cancelAppointment(userId);
    if (!cancelled) {
      return { reply: "No encontré citas activas para cancelar 🐾", step: null, sessionPatch: clearSchedulingPatch(), forceRuleReply: true };
    }
    const dateLabel = formatAppointmentDateLabel(cancelled);
    return {
      reply: `Listo, cancelé tu cita del ${dateLabel} ✅ ¿Deseas reagendar?`,
      step: null, sessionPatch: clearSchedulingPatch(), forceRuleReply: true,
    };
  } catch (error) {
    console.error("[Conversation] Cancel error:", error.message);
    return { reply: "Hubo un problema al cancelar 😔 ¿Intentamos de nuevo?", step: null, sessionPatch: {}, forceRuleReply: true };
  }
};

const handleReschedule = async (userId, session = {}) => {
  if (!userId) {
    return { reply: "No encontré citas para reprogramar 🐾", step: null, sessionPatch: clearSchedulingPatch(), forceRuleReply: true };
  }
  try {
    const cancelled = await cancelAppointment(userId);
    if (!cancelled) {
      return { reply: "No encontré citas para reprogramar 🐾", step: null, sessionPatch: clearSchedulingPatch(), forceRuleReply: true };
    }
    return {
      reply: "Cita cancelada ✅ ¿Para qué día y hora reagendamos?",
      step: STEPS.AWAITING_DATE_TIME,
      sessionPatch: buildRescheduleSessionPatch(cancelled, session),
      forceRuleReply: true,
    };
  } catch (error) {
    console.error("[Conversation] Reschedule error:", error.message);
    return { reply: "Hubo un problema al reprogramar 😔 ¿Intentamos de nuevo?", step: null, sessionPatch: {}, forceRuleReply: true };
  }
};

const handleQueryAppointments = async (userId) => {
  if (!userId) {
    return { reply: "No tienes citas programadas por ahora 🐾", step: null, sessionPatch: {}, forceRuleReply: true };
  }
  try {
    const appointments = await getUserAppointments(userId);
    if (!appointments.length) {
      return { reply: "No tienes citas programadas 🐾 ¿Te agendo una?", step: null, sessionPatch: {}, forceRuleReply: true };
    }
    const lines = appointments.map(formatAppointmentListLine).filter(Boolean);
    return {
      reply: `Tienes estas citas agendadas:\n${lines.join("\n")}`,
      step: null, sessionPatch: {}, forceRuleReply: true,
    };
  } catch (error) {
    console.error("[Conversation] Query appointments error:", error.message);
    return { reply: "No pude consultar tus citas 😔 ¿Intentamos de nuevo?", step: null, sessionPatch: {}, forceRuleReply: true };
  }
};

const handleQueryMedicalHistory = async (userId, session = {}, analysis = {}, userMessage = "") => {
  const petName = analysis?.pet_name ?? session?.pet_name;
  if (isMissing(petName)) {
    return { reply: "¿De qué mascota quieres ver el historial? 🐾", step: null, sessionPatch: {}, forceRuleReply: true };
  }
  if (!userId) {
    return { reply: `Aún no hay historial para ${petName} 🐾`, step: null, sessionPatch: {}, forceRuleReply: true };
  }
  try {
    const pet = await findPetByNameAndOwner(petName, userId);
    if (!pet) {
      return { reply: `Aún no hay historial para ${petName} 🐾`, step: null, sessionPatch: {}, forceRuleReply: true };
    }
    const filterType = resolveMedicalHistoryFilter(userMessage);
    const records = filterType
      ? await getRecordsByType(pet.id, filterType)
      : await getRecordsByPet(pet.id);
    if (!records.length) {
      return { reply: `Aún no hay historial para ${pet.name} 🐾`, step: null, sessionPatch: {}, forceRuleReply: true };
    }
    const emoji = getPetEmoji(pet.type ?? analysis?.pet_type ?? session?.pet_type);
    const body = formatRecordsForWhatsApp(records, { filterType });
    return { reply: `Historial de ${pet.name} ${emoji}:\n${body}`, step: null, sessionPatch: {}, forceRuleReply: true };
  } catch (error) {
    console.error("[Conversation] Query medical history error:", error.message);
    return { reply: "No pude consultar el historial 😔 ¿Intentamos de nuevo?", step: null, sessionPatch: {}, forceRuleReply: true };
  }
};

// ─── Grooming: ofrecer el siguiente slot disponible ───────────────────────────

const offerNextGroomingSlot = async (petName, referenceDate) => {
  const slot = await findNextAvailableGroomingSlot({ referenceDate });

  if (!slot) {
    return {
      reply: "Por el momento no tenemos espacios disponibles en grooming 😔 ¿Quieres que te avisemos cuando se libere uno?",
      step: null,
      sessionPatch: {},
    };
  }

  const dayLabel = scheduling.formatRelativeDayLabel(slot.date, referenceDate);
  const timeLabel = scheduling.formatHourAmPm(slot.hour);
  const petPart = petName ? ` para ${petName}` : "";

  return {
    reply: `¡Claro! ${capitalize(dayLabel)} tenemos disponibilidad a las ${timeLabel}${petPart} 🛁 ¿Te queda bien esa hora?`,
    step: STEPS.AWAITING_GROOMING_SLOT_CONFIRM,
    sessionPatch: {
      scheduling_date_key: slot.date,
      scheduling_hour: slot.hour,
    },
  };
};

// Construye el reply de cita de grooming confirmada
const buildGroomingConfirmedReply = (session, extra = {}) => {
  const dateKey = extra.scheduling_date_key ?? session.scheduling_date_key;
  const hour = extra.scheduling_hour ?? session.scheduling_hour;
  const now = extra.now || new Date();

  const dayLabel = dateKey ? scheduling.formatRelativeDayLabel(dateKey, now) : "";
  const timeLabel = hour != null ? scheduling.formatHourAmPm(hour) : "";
  const petName = session.pet_name;
  const petPart = petName ? ` para ${petName}` : "";
  const domicilioAddress = extra.domicilio_address ?? session.domicilio_address;

  if (domicilioAddress) {
    return `¡Listo! Cita de grooming agendada${petPart} para ${dayLabel} a las ${timeLabel}, pasamos a recogerte en ${domicilioAddress} 🐾 ¡Hasta pronto!`;
  }
  return `¡Listo! Cita de grooming agendada${petPart} para ${dayLabel} a las ${timeLabel} 🐾 ¡Te esperamos en Mateos Pet!`;
};

// ─── Medical save helper ──────────────────────────────────────────────────────

const buildMedicalSaveConfirmation = (petName, extracted) => {
  const name = String(petName || "tu mascota").trim();
  const title = String(extracted.title || "").trim();
  if (extracted.type === "allergy") {
    const phrase = title.toLowerCase().startsWith("alergia")
      ? title.toLowerCase()
      : `alergia ${title.toLowerCase()}`;
    return `Anotado ✅ Guardé que ${name} tiene ${phrase}.`;
  }
  return `Anotado ✅ Guardé en el historial de ${name}: ${title}.`;
};

const trySaveMedicalInfo = async ({ userMessage, session, analysis, userId }) => {
  const currentStep = session?.step ?? analysis?.step;
  if (currentStep && BOOKING_STEPS.has(currentStep)) return null;
  if (detectQueryMedicalHistoryIntent(userMessage, analysis?.intent)) return null;

  const petName = session?.pet_name ?? analysis?.pet_name;
  if (!userId || isMissing(petName) || isMissing(userMessage)) return null;

  try {
    const extracted = await detectMedicalInfo(userMessage);
    if (!extracted) return null;

    const pet = await findPetByNameAndOwner(petName, userId);
    if (!pet?.id) return null;

    const duplicate = await recordExists(pet.id, extracted.type, extracted.title);
    if (duplicate) return null;

    await createRecord(pet.id, extracted.type, extracted.title, extracted.detail, extracted.date);
    return buildMedicalSaveConfirmation(pet.name, extracted);
  } catch (error) {
    console.error("[Conversation] trySaveMedicalInfo error:", error.message);
    return null;
  }
};

// ─── Lógica principal ─────────────────────────────────────────────────────────

const isVetLikeService = (service) =>
  service === "veterinary_consultation" ||
  service === "medication" ||
  service === "general_appointment";

const resolveGenerateReplyInput = (input, options = {}) => {
  if (
    input && typeof input === "object" && !Array.isArray(input) &&
    ("analysis" in input || "semanticContext" in input || "session" in input)
  ) {
    return {
      analysis: input.analysis,
      session: input.session || {},
      semanticContext: input.semanticContext || "",
      userMessage: input.userMessage || "",
      options,
    };
  }
  return { analysis: input, session: {}, semanticContext: "", userMessage: "", options };
};

const shouldUseRuleReplyOnly = (ruleResult, analysis) => {
  if (ruleResult?.forceRuleReply) return true;
  if (MANAGEMENT_INTENTS.has(analysis?.intent)) return true;
  const step = ruleResult?.step;
  return step != null && BOOKING_STEPS.has(step);
};

const buildRuleBasedReply = async (analysis, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();
  const session = options.session || {};
  const userMessage = options.userMessage || "";
  const userId = options.userId;
  const currentStep = session.step ?? analysis?.step;

  if (!analysis || typeof analysis !== "object") {
    return { reply: "¡Hola! Soy Lina 😊 ¿En qué te podemos colaborar? 🐾", step: null, sessionPatch: {} };
  }

  const intent = analysis.intent;

  // ── 0. Transferencia a humano (prioridad absoluta) ────────────────────────────
  if (detectHumanTakeoverIntent(userMessage)) {
    return {
      reply: "Con gusto 🐾 Te comunico con Lina, en un momento te atiende. También puedes escribirnos directamente si es urgente.",
      step: "human_takeover",
      sessionPatch: { requires_human_attention: true },
      forceRuleReply: true,
    };
  }

  // ── 1. Gestión (máxima prioridad) ────────────────────────────────────────────
  if (detectRescheduleIntent(userMessage, intent)) return handleReschedule(userId, session);
  if (detectCancelIntent(userMessage, intent)) return handleCancellation(userId);
  if (detectQueryAppointmentsIntent(userMessage, intent)) return handleQueryAppointments(userId);
  if (detectQueryMedicalHistoryIntent(userMessage, intent)) {
    return handleQueryMedicalHistory(userId, session, analysis, userMessage);
  }

  // ── 2. Saludo (siempre reinicia, sin importar el estado anterior) ────────────
  if (intent === "greeting") {
    const userName = options.userName ? `, ${options.userName.split(" ")[0]}` : "";
    return {
      reply: `¡Hola${userName}! Soy Lina 😊 ¿En qué te podemos colaborar hoy? 🐾`,
      step: null,
      sessionPatch: {
        step: null,
        requested_service: null,
        scheduling_date_key: null,
        scheduling_hour: null,
        pet_name: null,
        pet_type: null,
      },
      forceRuleReply: true,
    };
  }

  // ── 2b. Sin cita: vacunación / desparasitación ────────────────────────────────
  if (detectNoAppointmentNeeded(userMessage)) {
    return {
      reply: "Para vacunación y desparasitación no necesitas cita 🐾 Puedes venir directamente cualquier día de 11am a 5pm. ¡Te esperamos!",
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }

  // ── 3. Wizard grooming activo ─────────────────────────────────────────────────

  // 3a. Usuario responde al slot ofrecido
  if (currentStep === STEPS.AWAITING_GROOMING_SLOT_CONFIRM) {
    if (isConfirmationMessage(userMessage)) {
      return {
        reply: "¡Perfecto! ¿Lo traes tú al salón o prefieres que lo recojamos en casa? 🏠",
        step: STEPS.AWAITING_DOMICILIO,
        sessionPatch: {},
      };
    }
    // No quiere ese slot → re-ofrecer (el siguiente libre real puede cambiar)
    const nextSlot = await offerNextGroomingSlot(session.pet_name, now);
    return nextSlot;
  }

  // 3b. Usuario responde sobre domicilio
  if (currentStep === STEPS.AWAITING_DOMICILIO) {
    const wantsDomicilio = detectDomicilioIntent(userMessage);

    if (wantsDomicilio === true) {
      return {
        reply: "Con gusto 🐾 ¿Cuál es la dirección de recogida?",
        step: STEPS.AWAITING_DOMICILIO_ADDRESS,
        sessionPatch: { domicilio: true },
      };
    }

    if (wantsDomicilio === false) {
      return {
        reply: buildGroomingConfirmedReply(session, { now }),
        step: STEPS.COMPLETED,
        sessionPatch: { domicilio: false },
        createGroomingAppointment: true,
      };
    }

    return {
      reply: "¿Lo traes tú al salón o te lo recogemos? 🐾",
      step: STEPS.AWAITING_DOMICILIO,
      sessionPatch: {},
    };
  }

  // 3c. Usuario da la dirección
  if (currentStep === STEPS.AWAITING_DOMICILIO_ADDRESS) {
    const address = userMessage.trim();
    if (!address || address.length < 4) {
      return {
        reply: "¿Cuál es la dirección exacta de recogida? 📍",
        step: STEPS.AWAITING_DOMICILIO_ADDRESS,
        sessionPatch: {},
      };
    }
    return {
      reply: buildGroomingConfirmedReply(session, { domicilio_address: address, now }),
      step: STEPS.COMPLETED,
      sessionPatch: { domicilio_address: address },
      createGroomingAppointment: true,
    };
  }

  // ── 4. Flujo completado ───────────────────────────────────────────────────────
  if (analysis.step === STEPS.COMPLETED) {
    return {
      reply: "¡Hola de nuevo! 😊 Soy Lina, ¿en qué te podemos colaborar hoy? 🐾",
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }

  const petType = analysis.pet_type;
  const petName = analysis.pet_name;
  const service = analysis.requested_service;
  const date = analysis.date;
  const time = analysis.time;

  // ── 5. Info / otros ──────────────────────────────────────────────────────────
  if (intent === "ask_info") {
    return {
      reply:
        "Con gusto te cuento 😊 Tenemos servicios veterinarios (consulta, laboratorio, rayos X, ecografía, cirugías) y grooming. Para vacunación y desparasitación puedes venir sin cita de 11am a 5pm 🐾 ¿Qué necesitas?",
      step: null,
      sessionPatch: {},
    };
  }

  if (intent === "save_medical_info") {
    if (isMissing(petName)) {
      return { reply: "¿Cómo se llama tu mascota? 🐾", step: null, sessionPatch: {} };
    }
    return { reply: "Gracias por contarnos 🐾", step: null, sessionPatch: {} };
  }

  // ── 6. Agendamiento ───────────────────────────────────────────────────────────
  const isBooking =
    !MANAGEMENT_INTENTS.has(intent) &&
    (intent === "schedule_appointment" || !isMissing(service));

  if (isBooking) {
    if (isMissing(service)) {
      return {
        reply: "¡Con gusto te agendo! 🐾 ¿Es para veterinaria o grooming?",
        step: null,
        sessionPatch: {},
      };
    }

    if (isMissing(petName)) {
      // Si el usuario tiene varias mascotas registradas, listarlas
      if (userId) {
        try {
          const userPets = await getUserPets(userId);
          if (userPets && userPets.length > 1) {
            const petList = userPets.map((p) => `• ${p.name}`).join("\n");
            return {
              reply: `¡Claro! ¿Para cuál de tus mascotas es? 🐾\n${petList}`,
              step: STEPS.AWAITING_PET_NAME,
              sessionPatch: {},
            };
          }
          if (userPets && userPets.length === 1) {
            // Solo una mascota registrada: usarla automáticamente
            const onlyPet = userPets[0];
            return buildRuleBasedReply(
              { ...analysis, pet_name: onlyPet.name, pet_type: onlyPet.type },
              options
            );
          }
        } catch { /* si falla el lookup, caemos al flujo normal */ }
      }
      const label = getPetLabel(petType);
      return {
        reply: service === "bath_grooming"
          ? `¡Claro! ¿Cómo se llama tu ${label}? 🐾`
          : `¡Con gusto! ¿Cómo se llama tu ${label}? 🐾`,
        step: STEPS.AWAITING_PET_NAME,
        sessionPatch: {},
      };
    }

    if (isMissing(petType)) {
      return {
        reply: `¿${petName} es perro o gato? 🐶🐱`,
        step: STEPS.AWAITING_PET_TYPE,
        sessionPatch: {},
      };
    }

    // ── Grooming ─────────────────────────────────────────────────────────────────
    if (service === "bath_grooming") {
      const groomSvc = parseGroomingService(userMessage) || session.grooming_service;
      const slotResult = await offerNextGroomingSlot(petName, now);
      if (groomSvc && slotResult.sessionPatch) {
        slotResult.sessionPatch.grooming_service = groomSvc;
      }
      return slotResult;
    }

    // ── Veterinaria ───────────────────────────────────────────────────────────────
    if (isVetLikeService(service)) {
      if (isMissing(date) || isMissing(time)) {
        return {
          reply: "¡Con gusto te agendo! ¿Para qué día y hora te queda mejor? 📅 _(Atendemos de 11am a 5pm)_",
          step: STEPS.AWAITING_DATE_TIME,
          sessionPatch: {},
        };
      }

      const vet = await scheduling.resolveVetScheduling({
        dateText: date,
        timeText: time,
        referenceDate: now,
        awaitingStepConstant: STEPS.AWAITING_DATE_TIME,
        confirmationStepConstant: STEPS.AWAITING_CONFIRMATION,
      });

      if (vet) {
        return { reply: vet.reply, step: vet.step, sessionPatch: vet.sessionPatch || {} };
      }

      return {
        reply: "¿Me dices el día y la hora de nuevo? 📅 (ej. mañana a las 2pm)",
        step: STEPS.AWAITING_DATE_TIME,
        sessionPatch: {},
      };
    }

    if (isMissing(date) || isMissing(time)) {
      return {
        reply: "¿Qué día y hora te queda mejor? 📅",
        step: STEPS.AWAITING_DATE_TIME,
        sessionPatch: {},
      };
    }

    return {
      reply: `¡Listo! Cita para ${petName} el ${date} a las ${time} 🐾 ¿Confirmamos?`,
      step: STEPS.AWAITING_CONFIRMATION,
      sessionPatch: {},
    };
  }

  return {
    reply: "¡Hola! Soy Lina 😊 ¿En qué te podemos colaborar hoy? 🐾",
    step: null,
    sessionPatch: {},
  };
};

const generateReply = async (input, legacyOptions) => {
  const { analysis, session, semanticContext, userMessage, options } =
    resolveGenerateReplyInput(input, legacyOptions);

  const ruleResult = await buildRuleBasedReply(analysis, {
    ...options,
    session,
    userMessage,
  });

  const medicalConfirmation = await trySaveMedicalInfo({
    userMessage,
    session,
    analysis,
    userId: options?.userId,
  });

  if (medicalConfirmation) {
    ruleResult.reply = `${ruleResult.reply}\n\n${medicalConfirmation}`;
  }

  const contextText = typeof semanticContext === "string" ? semanticContext.trim() : "";

  if (!contextText || shouldUseRuleReplyOnly(ruleResult, analysis)) {
    return ruleResult;
  }

  try {
    const aiReply = await generateReplyWithAI({
      analysis,
      session,
      semanticContext: contextText,
      userMessage,
      suggestedReply: ruleResult.reply,
    });
    if (aiReply) return { ...ruleResult, reply: aiReply };
  } catch (error) {
    console.error("[Conversation] AI reply failed, using rule-based:", error.message);
  }

  return ruleResult;
};

const getConfirmationReply = () => ({
  reply: "¡Listo! Tu cita quedó agendada 🐾 ¡Te esperamos en Mateos Pet! Soy Lina, cualquier cosa me escribes 😊",
  step: STEPS.COMPLETED,
  sessionPatch: {},
});

module.exports = {
  STEPS,
  confirmationKeywords,
  normalizeText,
  isConfirmationMessage,
  generateReply,
  getConfirmationReply,
};
