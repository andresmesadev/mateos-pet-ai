const { resolveAppointmentPrice, PRICE_SOURCES } = require("../../services/domain/price-resolver.service");

const appointment = {
  status: "confirmed",
  petId: "luna",
  finalPrice: null,
  pet: { defaultGroomingPrice: null },
  service: {
    basePrice: 50000,
    priceRules: [
      { targetId: "luna", price: 70000 },
      { targetId: "milo", price: 65000 },
    ],
  },
};

test("uses the agreed pet price only for the matching service and pet", () => {
  const agreed = resolveAppointmentPrice(appointment);
  expect(agreed.finalPrice).toBe(70000);
  expect(agreed.source).toBe(PRICE_SOURCES.PET_AGREED_PRICE);

  expect(resolveAppointmentPrice({ ...appointment, petId: "nala" }).finalPrice).toBe(50000);
  expect(resolveAppointmentPrice({ ...appointment, service: { basePrice: 80000, priceRules: [] } }).finalPrice).toBe(80000);
});

test("a manual appointment price wins and completed appointments keep their recorded amount", () => {
  expect(resolveAppointmentPrice({ ...appointment, finalPrice: 75000 }).finalPrice).toBe(75000);
  expect(resolveAppointmentPrice({ ...appointment, status: "completed", finalPrice: 70000 }).finalPrice).toBe(70000);
  expect(resolveAppointmentPrice({ ...appointment, status: "completed", finalPrice: null }).finalPrice).toBe(50000);
});
