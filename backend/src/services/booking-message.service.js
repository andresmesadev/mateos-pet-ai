// WhatsApp presentation only. Call after a booking has actually been persisted.
const { formatSlotForUser } = require("../lib/timezone");

const buildBookingConfirmation = ({ petName, serviceType, dateKey, hour, pickup = false, address }) => {
  const slot = formatSlotForUser(dateKey, hour);
  const [date, time] = slot.split(" a las ");
  const label = { vet: "Consulta veterinaria", veterinary_consultation: "Consulta veterinaria",
    grooming: "Peluquería", bath_grooming: "Peluquería", general_appointment: "Cita general",
    medication: "Medicamentos" }[serviceType] || serviceType;
  const lines = ["✅ ¡Listo! Tu cita quedó agendada.", "",
    `🐾 Mascota: ${petName}`,
    `🩺 Servicio: ${label}`,
    `📅 Fecha: ${date}`, `🕐 Hora: ${time}`];
  if (pickup && address) {
    lines.push("", "🚐 Recogida a domicilio", `📍 Dirección de recogida: ${address}`);
  } else {
    lines.push("", "📍 Atención en el establecimiento.");
  }
  lines.push("", "¡Gracias por confiar en nosotros! Que tengas un buen día. ¡Hasta pronto! 🐾");
  return lines.join("\n");
};

module.exports = { buildBookingConfirmation };
