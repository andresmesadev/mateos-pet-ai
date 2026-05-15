const STEPS = {
  AWAITING_PET_NAME: "awaiting_pet_name",
  AWAITING_PET_TYPE: "awaiting_pet_type",
  AWAITING_DATE_TIME: "awaiting_date_time",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  COMPLETED: "completed",
};

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

const generateReply = (analysis) => {
  if (!analysis || typeof analysis !== "object") {
    return {
      reply: "¿Me cuentas un poco más? 🐾 Con gusto te ayudo.",
      step: null,
    };
  }

  if (analysis.step === STEPS.COMPLETED) {
    return {
      reply:
        "¡Hola de nuevo! 😊 Tu cita ya está confirmada en Mateos Pet 🐾\n¿Te ayudo con algo más?",
      step: null,
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
    };
  }

  if (intent === "ask_info") {
    return {
      reply:
        "Con gusto te oriento 😊\nOfrecemos baño y peluquería, consultas veterinarias, medicamentos y citas.\n¿Qué necesitas?",
      step: null,
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
      };
    }

    if (isMissing(petName)) {
      const petLabel = getPetLabel(petType);
      const reply =
        service === "bath_grooming"
          ? `¡Claro! 🛁\n¿Cuál es el nombre de tu ${petLabel}?`
          : `¡Perfecto! 😊\n¿Cuál es el nombre de tu ${petLabel}?`;

      return { reply, step: STEPS.AWAITING_PET_NAME };
    }

    if (isMissing(petType)) {
      return {
        reply: "Claro 😊 ¿Tu mascota es perro o gato?",
        step: STEPS.AWAITING_PET_TYPE,
      };
    }

    if (isMissing(date) || isMissing(time)) {
      return {
        reply: "¿Qué día y hora te queda mejor? 📅",
        step: STEPS.AWAITING_DATE_TIME,
      };
    }

    const serviceLabel = getServiceLabel(service);
    const name = petName || getPetLabel(petType);

    return {
      reply: `¡Listo! 🐾\n${serviceLabel} para ${name} el ${date} a las ${time}.\n¿Confirmamos la cita?`,
      step: STEPS.AWAITING_CONFIRMATION,
    };
  }

  return {
    reply:
      "¡Hola! 😊 Bienvenido a Mateos Pet 🐾\n¿En qué podemos ayudarte hoy?",
    step: null,
  };
};

const getConfirmationReply = () => ({
  reply: "¡Perfecto! 😊 Tu cita quedó confirmada en Mateos Pet 🐾",
  step: STEPS.COMPLETED,
});

module.exports = {
  STEPS,
  confirmationKeywords,
  normalizeText,
  isConfirmationMessage,
  generateReply,
  getConfirmationReply,
};
