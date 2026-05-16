const STEPS = {
  AWAITING_PET_NAME: "awaiting_pet_name",
  AWAITING_PET_TYPE: "awaiting_pet_type",
  AWAITING_DATE_TIME: "awaiting_date_time",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  COMPLETED: "completed",
};

const scheduling = require("./scheduling.service");
const { generateReply: generateReplyWithAI } = require("./openai.service");

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

const shouldUseRuleReplyOnly = (ruleResult) => {
  const step = ruleResult?.step;
  return step != null && BOOKING_STEPS.has(step);
};

const buildRuleBasedReply = async (analysis, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();

  if (!analysis || typeof analysis !== "object") {
    return {
      reply: "¿Me cuentas un poco más? 🐾 Con gusto te ayudo.",
      step: null,
      sessionPatch: {},
    };
  }

  if (analysis.step === STEPS.COMPLETED) {
    return {
      reply:
        "¡Hola de nuevo! 😊 Tu cita ya está confirmada en Mateos Pet 🐾\n¿Te ayudo con algo más?",
      step: null,
      sessionPatch: {},
    };
  }

  const intent = analysis.intent;
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

  const isBooking =
    intent === "schedule_appointment" || !isMissing(service);

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

  const ruleResult = await buildRuleBasedReply(analysis, options);
  const contextText =
    typeof semanticContext === "string" ? semanticContext.trim() : "";

  if (!contextText || shouldUseRuleReplyOnly(ruleResult)) {
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
