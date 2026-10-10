// WhatsApp presentation only. Call after a booking has actually been persisted.
const { formatSlotForUser } = require("../lib/timezone");

const bookingDetails = ({ petName, serviceType, dateKey, hour, pickup = false, address }) => {
  const slot = formatSlotForUser(dateKey, hour);
  const [date, time] = slot.split(" a las ");
  const label = { vet: "Consulta veterinaria", veterinary_consultation: "Consulta veterinaria",
    grooming: "Peluquería", bath_grooming: "Peluquería", general_appointment: "Cita general",
    medication: "Medicamentos" }[serviceType] || serviceType;
  const lines = [`🐾 Mascota: ${petName}`,
    `🩺 Servicio: ${label}`,
    `📅 Fecha: ${date}`, `🕐 Hora: ${time}`];
  if (pickup && address) {
    lines.push("", "🚐 Recogida a domicilio", `📍 Dirección de recogida: ${address}`);
  } else {
    lines.push("", "📍 Atención en el establecimiento.");
  }
  return lines.join("\n");
};

const buildBookingConfirmation = details => ["✅ ¡Listo! Tu cita quedó agendada.", "", bookingDetails(details), "",
  "¡Gracias por confiar en nosotros! Que tengas un buen día. ¡Hasta pronto! 🐾"].join("\n");

const buildBookingReview = (session) => {
  const summary = bookingDetails({ petName: session.pet_name,
    serviceType: session.grooming_service || session.requested_service,
    dateKey: session.scheduling_date_key, hour: session.scheduling_hour,
    pickup: session.domicilio === true, address: session.domicilio_address });
  return `Revisa los datos de tu reserva:\n\n${summary}\n\n¿Confirmas esta cita? Aún no está guardada.`;
};

module.exports = { buildBookingConfirmation, buildBookingReview };
