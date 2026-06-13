const STEPS = {
  AWAITING_PET_NAME: "awaiting_pet_name",
  AWAITING_PET_TYPE: "awaiting_pet_type",
  AWAITING_DATE_TIME: "awaiting_date_time",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  COMPLETED: "completed",
};

const scheduling = require("./scheduling.service");
const { generateReply: generateReplyWithAI } = require("./openai.service");
const { findPetByNameAndOwner } = require("./pet.service");
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

const MANAGEMENT_INTENTS = new Set([
  "cancel_appointment",
  "reschedule_appointment",
  "query_appointments",
  "query_medical_history",
]);

const CANCEL_PATTERNS = [
  "cancelar cita",
  "cancela mi cita",
  "quiero cancelar",
  "no puedo ir",
  "cancelar mi cita",
];

const RESCHEDULE_PATTERNS = [
  "cambiar cita",
  "reprogramar",
  "cambiar horario",
  "reagendar",
  "cambiar la cita",
  "mover la cita",
];

const QUERY_APPOINTMENTS_PATTERNS = [
  "mi cita",
  "mis citas",
  "cuando tengo cita",
  "cita pendiente",
  "proxima cita",
  "cual es mi cita",
  "tengo cita pendiente",
  "cuando es mi cita",
];

const QUERY_MEDICAL_HISTORY_PATTERNS = [
  "historial medico",
  "historial de",
  "que alergias",
  "que tiene anotado",
  "a que es alergico",
  "a que es alergica",
  "cuando fue vacunado",
  "cuando fue vacunada",
  "que vacunas",
  "anotado de",
  "registro medico",
];

const clearSchedulingPatch = () => ({
  scheduling_date_key: undefined,
  scheduling_hour: undefined,
  date: undefined,
  time: undefined,
});

const detectCancelIntent = (text, intent) => {
  if (intent === "cancel_appointment") {
    return true;
  }

  const normalized = normalizeText(text);
  return CANCEL_PATTERNS.some((pattern) => normalized.includes(pattern));
};

const detectRescheduleIntent = (text, intent) => {
  if (intent === "reschedule_appointment") {
    return true;
  }

  const normalized = normalizeText(text);

  if (RESCHEDULE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }

  if (normalized.includes("otro dia")) {
    return (
      normalized.includes("cita") ||
      normalized.includes("horario") ||
      normalized.includes("reprogram") ||
      normalized.includes("cambiar")
    );
  }

  return false;
};

const detectQueryAppointmentsIntent = (text, intent) => {
  if (intent === "query_appointments") {
    return true;
  }

  const normalized = normalizeText(text);
  return QUERY_APPOINTMENTS_PATTERNS.some((pattern) =>
    normalized.includes(pattern)
  );
};

const detectQueryMedicalHistoryIntent = (text, intent) => {
  if (intent === "query_medical_history") {
    return true;
  }

  const normalized = normalizeText(text);
  return QUERY_MEDICAL_HISTORY_PATTERNS.some((pattern) =>
    normalized.includes(pattern)
  );
};

const resolveMedicalHistoryFilter = (text) => {
  const normalized = normalizeText(text);

  if (
    normalized.includes("alerg") ||
    normalized.includes("alergic")
  ) {
    return "allergy";
  }

  if (normalized.includes("vacun")) {
    return "vaccine";
  }

  if (normalized.includes("consult")) {
    return "consultation";
  }

  if (normalized.includes("nota")) {
    return "note";
  }

  return null;
};

const getPetEmoji = (petType) => {
  if (petType === "dog") return "🐶";
  if (petType === "cat") return "🐱";
  return "🐾";
};

const buildRescheduleSessionPatch = (cancelled, session = {}) => {
  const patch = {
    ...clearSchedulingPatch(),
    step: STEPS.AWAITING_DATE_TIME,
  };

  if (cancelled) {
    patch.pet_name = cancelled.petName;
    patch.pet_type = cancelled.petType;
    patch.requested_service =
      mapDbServiceTypeToSession(cancelled.serviceType) ??
      session.requested_service;
  } else {
    if (!isMissing(session.pet_name)) patch.pet_name = session.pet_name;
    if (!isMissing(session.pet_type)) patch.pet_type = session.pet_type;
    if (!isMissing(session.requested_service)) {
      patch.requested_service = session.requested_service;
    }
  }

  return patch;
};

const handleCancellation = async (userId) => {
  if (!userId) {
    return {
      reply: "No encontré citas activas.",
      step: null,
      sessionPatch: clearSchedulingPatch(),
      forceRuleReply: true,
    };
  }

  try {
    const cancelled = await cancelAppointment(userId);

    if (!cancelled) {
      return {
        reply: "No encontré citas activas.",
        step: null,
        sessionPatch: clearSchedulingPatch(),
        forceRuleReply: true,
      };
    }

    const dateLabel = formatAppointmentDateLabel(cancelled);

    return {
      reply: `Tu cita del ${dateLabel} ha sido cancelada.\n¿Deseas agendar una nueva?`,
      step: null,
      sessionPatch: clearSchedulingPatch(),
      forceRuleReply: true,
    };
  } catch (error) {
    console.error("[Conversation] Cancel appointment error:", error.message);
    return {
      reply:
        "Hubo un problema al cancelar tu cita 😔\n¿Podemos intentarlo de nuevo en un momento?",
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }
};

const handleReschedule = async (userId, session = {}) => {
  if (!userId) {
    return {
      reply: "No encontré citas activas para reprogramar.",
      step: null,
      sessionPatch: clearSchedulingPatch(),
      forceRuleReply: true,
    };
  }

  try {
    const cancelled = await cancelAppointment(userId);

    if (!cancelled) {
      return {
        reply: "No encontré citas activas para reprogramar.",
        step: null,
        sessionPatch: clearSchedulingPatch(),
        forceRuleReply: true,
      };
    }

    return {
      reply:
        "Cita cancelada. ¿Para qué fecha y hora te gustaría reagendar?",
      step: STEPS.AWAITING_DATE_TIME,
      sessionPatch: buildRescheduleSessionPatch(cancelled, session),
      forceRuleReply: true,
    };
  } catch (error) {
    console.error("[Conversation] Reschedule appointment error:", error.message);
    return {
      reply:
        "Hubo un problema al reprogramar tu cita 😔\n¿Podemos intentarlo de nuevo en un momento?",
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }
};

const handleQueryAppointments = async (userId) => {
  if (!userId) {
    return {
      reply: "No tienes citas programadas. ¿Deseas agendar una?",
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }

  try {
    const appointments = await getUserAppointments(userId);

    if (!appointments.length) {
      return {
        reply: "No tienes citas programadas. ¿Deseas agendar una?",
        step: null,
        sessionPatch: {},
        forceRuleReply: true,
      };
    }

    const lines = appointments
      .map(formatAppointmentListLine)
      .filter(Boolean);

    return {
      reply: `Tienes las siguientes citas:\n${lines.join("\n")}`,
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  } catch (error) {
    console.error("[Conversation] Query appointments error:", error.message);
    return {
      reply:
        "Hubo un problema al consultar tus citas 😔\n¿Podemos intentarlo de nuevo en un momento?",
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }
};

const handleQueryMedicalHistory = async (
  userId,
  session = {},
  analysis = {},
  userMessage = ""
) => {
  const petName = analysis?.pet_name ?? session?.pet_name;

  if (isMissing(petName)) {
    return {
      reply:
        "¿De qué mascota quieres consultar el historial médico? 🐾",
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }

  if (!userId) {
    return {
      reply: `No hay historial para ${petName} aún.`,
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }

  try {
    const pet = await findPetByNameAndOwner(petName, userId);

    if (!pet) {
      return {
        reply: `No hay historial para ${petName} aún.`,
        step: null,
        sessionPatch: {},
        forceRuleReply: true,
      };
    }

    const filterType = resolveMedicalHistoryFilter(userMessage);
    const records = filterType
      ? await getRecordsByType(pet.id, filterType)
      : await getRecordsByPet(pet.id);

    if (!records.length) {
      return {
        reply: `No hay historial para ${pet.name} aún.`,
        step: null,
        sessionPatch: {},
        forceRuleReply: true,
      };
    }

    const petType = pet.type ?? analysis?.pet_type ?? session?.pet_type;
    const emoji = getPetEmoji(petType);
    const body = formatRecordsForWhatsApp(records, { filterType });

    return {
      reply: `Historial de ${pet.name} ${emoji}:\n${body}`,
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  } catch (error) {
    console.error("[Conversation] Query medical history error:", error.message);
    return {
      reply:
        "Hubo un problema al consultar el historial 😔\n¿Podemos intentarlo de nuevo en un momento?",
      step: null,
      sessionPatch: {},
      forceRuleReply: true,
    };
  }
};

const BOOKING_STEPS = new Set([
  STEPS.AWAITING_PET_NAME,
  STEPS.AWAITING_PET_TYPE,
  STEPS.AWAITING_DATE_TIME,
  STEPS.AWAITING_CONFIRMATION,
]);

const isVetLikeService = (service) =>
  service === "veterinary_consultation" ||
  service === "medication" ||
  service === "general_appointment";

const confirmationKeywords = [
  "si",
  "ok",
  "perfecto",
  "confirmar",
  "confirmo",
  "dale",
  "claro",
  "de acuerdo",
  "confirmado",
];

const normalizeText = (text) => {
  if (typeof text !== "string") {
    return "";
  }

  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const isMissing = (value) => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "" || normalized === "null" || normalized === "n/a";
  }

  return false;
};

const isConfirmationMessage = (text) => {
  const normalized = normalizeText(text);

  if (!normalized) {
    return false;
  }

  return confirmationKeywords.some((keyword) =>
    normalized.includes(normalizeText(keyword))
  );
};

const getPetLabel = (petType) => {
  if (petType === "dog") return "perrito";
  if (petType === "cat") return "gatito";
  return "mascota";
};

const getServiceLabel = (service) => {
  const labels = {
    bath_grooming: "baño y peluquería",
    veterinary_consultation: "consulta veterinaria",
    medication: "medicamentos",
    general_appointment: "cita",
  };
  return labels[service] || "servicio";
};

const resolveGenerateReplyInput = (input, options = {}) => {
  if (
    input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
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

  return {
    analysis: input,
    session: {},
    semanticContext: "",
    userMessage: "",
    options,
  };
};

const shouldUseRuleReplyOnly = (ruleResult, analysis) => {
  if (ruleResult?.forceRuleReply) {
    return true;
  }

  if (MANAGEMENT_INTENTS.has(analysis?.intent)) {
    return true;
  }

  const step = ruleResult?.step;
  return step != null && BOOKING_STEPS.has(step);
};

const buildMedicalSaveConfirmation = (petName, extracted) => {
  const name = String(petName || "tu mascota").trim();
  const title = String(extracted.title || "").trim();

  if (extracted.type === "allergy") {
    const phrase = title.toLowerCase().startsWith("alergia")
      ? title.toLowerCase()
      : `alergia ${title.toLowerCase()}`;
    return `Anotado ✅ Guardé que ${name} tiene ${phrase} en su historial.`;
  }

  return `Anotado ✅ Guardé que ${name}: ${title} en su historial.`;
};

const trySaveMedicalInfo = async ({ userMessage, session, analysis, userId }) => {
  const currentStep = session?.step ?? analysis?.step;

  if (currentStep && BOOKING_STEPS.has(currentStep)) {
    return null;
  }

  if (detectQueryMedicalHistoryIntent(userMessage, analysis?.intent)) {
    return null;
  }

  const petName = session?.pet_name ?? analysis?.pet_name;

  if (!userId || isMissing(petName) || isMissing(userMessage)) {
    return null;
  }

  try {
    const extracted = await detectMedicalInfo(userMessage);

    if (!extracted) {
      return null;
    }

    const pet = await findPetByNameAndOwner(petName, userId);

    if (!pet?.id) {
      console.log("[Conversation] Medical info skipped — pet not found in DB");
      return null;
    }

    const duplicate = await recordExists(pet.id, extracted.type, extracted.title);

    if (duplicate) {
      console.log(
        "[Conversation] Medical record duplicate skipped:",
        extracted.type,
        extracted.title
      );
      return null;
    }

    await createRecord(
      pet.id,
      extracted.type,
      extracted.title,
      extracted.detail,
      extracted.date
    );

    return buildMedicalSaveConfirmation(pet.name, extracted);
  } catch (error) {
    console.error("[Conversation] trySaveMedicalInfo error:", error.message);
    return null;
  }
};

const buildRuleBasedReply = async (analysis, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();
  const session = options.session || {};
  const userMessage = options.userMessage || "";
  const userId = options.userId;
  const currentStep = analysis?.step ?? session.step;

  if (!analysis || typeof analysis !== "object") {
    return {
      reply: "¿Me cuentas un poco más? 🐾 Con gusto te ayudo.",
      step: null,
      sessionPatch: {},
    };
  }

  const intent = analysis.intent;

  if (detectRescheduleIntent(userMessage, intent)) {
    return handleReschedule(userId, session);
  }

  if (detectCancelIntent(userMessage, intent)) {
    return handleCancellation(userId);
  }

  if (detectQueryAppointmentsIntent(userMessage, intent)) {
    return handleQueryAppointments(userId);
  }

  if (detectQueryMedicalHistoryIntent(userMessage, intent)) {
    return handleQueryMedicalHistory(userId, session, analysis, userMessage);
  }

  if (analysis.step === STEPS.COMPLETED) {
    return {
      reply:
        "¡Hola de nuevo! 😊 Tu cita ya está confirmada en Mateos Pet 🐾\n¿Te ayudo con algo más?",
      step: null,
      sessionPatch: {},
    };
  }

  const petType = analysis.pet_type;
  const petName = analysis.pet_name;
  const service = analysis.requested_service;
  const date = analysis.date;
  const time = analysis.time;

  if (intent === "greeting") {
    return {
      reply:
        "¡Hola! 😊 Bienvenido a Mateos Pet 🐾\n¿En qué podemos ayudarte hoy?",
      step: null,
      sessionPatch: {},
    };
  }

  if (intent === "ask_info") {
    return {
      reply:
        "Con gusto te oriento 😊\nOfrecemos baño y peluquería, consultas veterinarias, medicamentos y citas.\n¿Qué necesitas?",
      step: null,
      sessionPatch: {},
    };
  }

  if (intent === "save_medical_info") {
    if (isMissing(petName)) {
      return {
        reply:
          "¿Cuál es el nombre de tu mascota? Así lo anoto en su historial 🐾",
        step: null,
        sessionPatch: {},
      };
    }

    return {
      reply: "Gracias por contarnos 🐾",
      step: null,
      sessionPatch: {},
    };
  }

  const isBooking =
    !MANAGEMENT_INTENTS.has(intent) &&
    (intent === "schedule_appointment" || !isMissing(service));

  if (isBooking) {
    if (isMissing(service)) {
      return {
        reply:
          "Perfecto 🐾 ¿Qué servicio necesitas?\n• Baño y peluquería 🛁\n• Consulta veterinaria 🩺\n• Medicamentos 💊\n• Cita general 📅",
        step: null,
        sessionPatch: {},
      };
    }

    if (isMissing(petName)) {
      const petLabel = getPetLabel(petType);
      const reply =
        service === "bath_grooming"
          ? `¡Claro! 🛁\n¿Cuál es el nombre de tu ${petLabel}?`
          : `¡Perfecto! 😊\n¿Cuál es el nombre de tu ${petLabel}?`;

      return { reply, step: STEPS.AWAITING_PET_NAME, sessionPatch: {} };
    }

    if (isMissing(petType)) {
      return {
        reply: "Claro 😊 ¿Tu mascota es perro o gato?",
        step: STEPS.AWAITING_PET_TYPE,
        sessionPatch: {},
      };
    }

    if (service === "bath_grooming") {
      if (currentStep === STEPS.AWAITING_DATE_TIME) {
        if (isMissing(date) || isMissing(time)) {
          return {
            reply: "¿Para qué fecha y hora te gustaría reagendar? 📅",
            step: STEPS.AWAITING_DATE_TIME,
            sessionPatch: {},
          };
        }

        const groom = await scheduling.resolveGroomingScheduling({
          dateText: date,
          timeText: time,
          referenceDate: now,
          awaitingStepConstant: STEPS.AWAITING_DATE_TIME,
          confirmationStepConstant: STEPS.AWAITING_CONFIRMATION,
        });

        if (groom) {
          return {
            reply: groom.reply,
            step: groom.step,
            sessionPatch: groom.sessionPatch || {},
          };
        }

        return {
          reply:
            "¿Me dices el día y la hora de nuevo? 📅 (por ejemplo mañana a las 2pm)",
          step: STEPS.AWAITING_DATE_TIME,
          sessionPatch: {},
        };
      }

      const groom = await scheduling.resolveGroomingNextSlotMessage({
        referenceDate: now,
        awaitingConfirmationStep: STEPS.AWAITING_CONFIRMATION,
        awaitingDateTimeFallbackStep: STEPS.AWAITING_DATE_TIME,
      });
      return {
        reply: groom.reply,
        step: groom.step,
        sessionPatch: groom.sessionPatch || {},
      };
    }

    if (isVetLikeService(service)) {
      if (isMissing(date) || isMissing(time)) {
        return {
          reply: "¿Qué día y hora te queda mejor? 📅",
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
        return {
          reply: vet.reply,
          step: vet.step,
          sessionPatch: vet.sessionPatch || {},
        };
      }

      return {
        reply:
          "¿Me dices el día y la hora de nuevo? 📅 (por ejemplo mañana a las 2pm)",
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

    const serviceLabel = getServiceLabel(service);
    const name = petName || getPetLabel(petType);

    return {
      reply: `¡Listo! 🐾\n${serviceLabel} para ${name} el ${date} a las ${time}.\n¿Confirmamos la cita?`,
      step: STEPS.AWAITING_CONFIRMATION,
      sessionPatch: {},
    };
  }

  return {
    reply:
      "¡Hola! 😊 Bienvenido a Mateos Pet 🐾\n¿En qué podemos ayudarte hoy?",
    step: null,
    sessionPatch: {},
  };
};

const generateReply = async (input, legacyOptions) => {
  const {
    analysis,
    session,
    semanticContext,
    userMessage,
    options,
  } = resolveGenerateReplyInput(input, legacyOptions);

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

  const contextText =
    typeof semanticContext === "string" ? semanticContext.trim() : "";

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

    if (aiReply) {
      return {
        ...ruleResult,
        reply: aiReply,
      };
    }
  } catch (error) {
    console.error(
      "[Conversation] AI reply failed, using rule-based reply:",
      error.message
    );
  }

  return ruleResult;
};

const getConfirmationReply = () => ({
  reply: "¡Perfecto! 😊 Tu cita quedó confirmada en Mateos Pet 🐾",
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
