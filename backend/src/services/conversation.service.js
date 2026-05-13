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

const generateReply = (analysis) => {
  if (!analysis || typeof analysis !== "object") {
    return "Disculpa, no logré entender tu mensaje 🐾 ¿Podrías repetirlo?";
  }

  const intent = analysis.intent;
  const petType = analysis.pet_type;
  const service = analysis.requested_service;
  const date = analysis.date;
  const time = analysis.time;

  if (intent === "schedule_appointment" && isMissing(service)) {
    return "Perfecto 🐶 ¿Qué servicio necesitas para tu mascota?";
  }

  if (isMissing(petType)) {
    return "Claro 😊 ¿Qué tipo de mascota tienes?";
  }

  if (isMissing(date) || isMissing(time)) {
    return "¿Qué día y hora prefieres para la cita?";
  }

  return `¡Listo! 🐾 Agendamos un servicio de ${service} para tu ${petType} el ${date} a las ${time}. ¿Confirmas la cita?`;
};

module.exports = {
  generateReply,
};
