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
    return "¿Me cuentas un poco más? 🐾 Con gusto te ayudo.";
  }

  const intent = analysis.intent;
  const petType = analysis.pet_type;
  const petName = analysis.pet_name;
  const service = analysis.requested_service;
  const date = analysis.date;
  const time = analysis.time;

  if (intent === "greeting") {
    return "¡Hola! 😊 Bienvenido a Mateos Pet 🐾\n¿En qué podemos ayudarte hoy?";
  }

  if (intent === "ask_info") {
    return "Con gusto te oriento 😊\nOfrecemos baño y peluquería, consultas veterinarias, medicamentos y citas.\n¿Qué necesitas?";
  }

  const isBooking =
    intent === "schedule_appointment" || !isMissing(service);

  if (isBooking) {
    if (isMissing(service)) {
      return "Perfecto 🐾 ¿Qué servicio necesitas?\n• Baño y peluquería 🛁\n• Consulta veterinaria 🩺\n• Medicamentos 💊\n• Cita general 📅";
    }

    if (isMissing(petName)) {
      const petLabel = getPetLabel(petType);
      if (service === "bath_grooming") {
        return `¡Claro! 🛁\n¿Cuál es el nombre de tu ${petLabel}?`;
      }
      return `¡Perfecto! 😊\n¿Cuál es el nombre de tu ${petLabel}?`;
    }

    if (isMissing(petType)) {
      return "Claro 😊 ¿Tu mascota es perro o gato?";
    }

    if (isMissing(date) || isMissing(time)) {
      return "¿Qué día y hora te queda mejor? 📅";
    }

    const serviceLabel = getServiceLabel(service);
    const name = petName || getPetLabel(petType);
    return `¡Listo! 🐾\n${serviceLabel} para ${name} el ${date} a las ${time}.\n¿Confirmamos la cita?`;
  }

  return "¡Hola! 😊 Bienvenido a Mateos Pet 🐾\n¿En qué podemos ayudarte hoy?";
};

module.exports = {
  generateReply,
};
