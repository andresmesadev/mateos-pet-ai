const { buildBookingConfirmation } = require("../../services/booking-message.service");

const booking = { petName: "Luna", serviceType: "vet", dateKey: "2026-10-10", hour: 12 };

test("confirmation separates pet, service, date and time and includes a farewell", () => {
  const reply = buildBookingConfirmation(booking);
  expect(reply).toContain("🐾 Mascota: Luna\n🩺 Servicio: Consulta veterinaria\n📅 Fecha: 10/10/2026\n🕐 Hora: 12:00 PM (hora Colombia)");
  expect(reply).toContain("¡Hasta pronto!");
  expect(reply).not.toContain("recogida");
});

test("pickup confirmation includes the address and does not invite the client to attend", () => {
  const reply = buildBookingConfirmation({ ...booking, serviceType: "baño + corte", pickup: true, address: "Calle de prueba 10, apto 3" });
  expect(reply).toContain("Servicio: baño + corte");
  expect(reply).toContain("📍 Dirección de recogida: Calle de prueba 10, apto 3");
  expect(reply).not.toContain("Atención en el establecimiento");
});

test("bringing the pet ignores any stale pickup address", () => {
  const reply = buildBookingConfirmation({ ...booking, serviceType: "grooming", pickup: false, address: "Dirección antigua" });
  expect(reply).toContain("Servicio: Peluquería");
  expect(reply).not.toContain("Dirección antigua");
});
