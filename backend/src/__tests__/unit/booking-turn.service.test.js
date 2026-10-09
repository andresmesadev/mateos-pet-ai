const { prepareBookingTurn, separateClientAndPet, isAcknowledgementOnly, selectCurrentPet, confirmsSelectedPet } = require("../../services/booking-turn.service");
const { STEPS } = require("../../services/domain/booking-steps");
const { detectDomicilioIntent } = require("../../services/domain/intent-detector.service");

const now = new Date("2026-10-09T19:18:00Z");
const oldSession = { step: STEPS.AWAITING_GROOMING_SLOT_CONFIRM, client_name: "Persona A",
  pet_name: "Mascota A", requested_service: "bath_grooming", scheduling_date_key: "2026-09-28",
  scheduling_hour: 11, domicilio: true, domicilio_address: "Dirección de prueba" };

test("a new request cannot resume the expired grooming offer from another day", () => {
  const { previous } = prepareBookingTurn(oldSession, "Hola necesito una cita para mañana a las 11", now);
  expect(previous).toEqual(expect.objectContaining({ step: null, requested_service: null,
    scheduling_date_key: null, scheduling_hour: null, pet_name: null, domicilio_address: null,
    client_name: "Persona A" }));
  expect(oldSession.scheduling_date_key).toBe("2026-09-28");
});

test("confirmation of an expired persisted slot must return to gathering booking data", () => {
  const { previous } = prepareBookingTurn({ ...oldSession, step: STEPS.AWAITING_CONFIRMATION }, "Sí, confirmo", now);
  expect(previous.step).toBeNull();
  expect(previous.scheduling_date_key).toBeNull();
});

test("a slot earlier today is expired according to the business timezone", () => {
  const previous = prepareBookingTurn({ ...oldSession, scheduling_date_key: "2026-10-09" }, "Sí", now).previous;
  expect(previous.scheduling_date_key).toBeNull();
});

test("an active offer preserves its data for confirmation, but changing its date invalidates pickup", () => {
  const active = { ...oldSession, scheduling_date_key: "2026-10-10" };
  expect(prepareBookingTurn(active, "Sí", now).previous).toBe(active);
  const changed = prepareBookingTurn(active, "mejor el lunes", now, { dateKey: "2026-10-12", dateText: "mejor el lunes" }).previous;
  expect(changed.step).toBeNull();
  expect(changed.scheduling_date_key).toBeNull();
  expect(changed.requested_service).toBe("bath_grooming");
  expect(changed.domicilio_address).toBeNull();
});

test("the answer to a client-name question cannot also become a pet name", () => {
  const result = separateClientAndPet({ step: STEPS.AWAITING_CLIENT_NAME },
    { client_name: "Persona B", pet_name: "Persona B" }, "Persona B");
  expect(result.analysis.client_name).toBe("Persona B");
  expect(result.analysis.pet_name).toBeNull();
  expect(result.previous.pet_name).toBeNull();
});

test("an explicit owner correction removes the pet alias, but explicit pet naming is retained", () => {
  const result = separateClientAndPet({ client_name: "Persona B", pet_name: "Persona B" },
    { client_name: "Persona B", pet_name: "Persona B", pet_type: "dog" }, "Perro y Persona B es mi nombre");
  expect(result.previous.pet_name).toBeNull();
  expect(result.analysis.pet_name).toBeNull();
  expect(result.analysis.pet_type).toBe("dog");
  const explicit = separateClientAndPet({}, { client_name: "Luna", pet_name: "Luna" }, "Mi nombre es Luna y mi perro se llama Luna");
  expect(explicit.analysis.pet_name).toBe("Luna");
});

test("pure thanks are distinguished from confirmation and new requests", () => {
  expect(isAcknowledgementOnly("Muchas gracias 🐾!")).toBe(true);
  expect(isAcknowledgementOnly("Gracias por tu ayuda")).toBe(true);
  expect(isAcknowledgementOnly("Gracias, quiero otra cita")).toBe(false);
  expect(isAcknowledgementOnly("Sí, gracias")).toBe(false);
});

test("pickup at home is recognized without interpreting a negative answer as pickup", () => {
  expect(detectDomicilioIntent("En casa")).toBe(true);
  expect(detectDomicilioIntent("En mi casa.")).toBe(true);
  expect(detectDomicilioIntent("Yo lo llevo")).toBe(false);
  expect(detectDomicilioIntent("No en casa, yo lo llevo")).toBe(false);
});

test("two independent clients cannot change each other's prepared session", () => {
  const second = { ...oldSession, client_name: "Persona B", pet_name: "Mascota B", scheduling_date_key: "2026-10-10" };
  const a = prepareBookingTurn(oldSession, "Quiero otra cita", now).previous;
  const b = prepareBookingTurn(second, "Sí", now).previous;
  expect(a.requested_service).toBeNull();
  expect(b.pet_name).toBe("Mascota B");
  expect(b.scheduling_date_key).toBe("2026-10-10");
});

test("history cannot choose a pet for a new generic booking", () => {
  expect(selectCurrentPet({}, { pet_name: "Luna", pet_type: "cat" }, "Quiero una consulta mañana")).toEqual({ pet_name: null, pet_type: null });
});

test("an explicit name selects the pet; a short answer overrides an extractor using an old name", () => {
  expect(selectCurrentPet({}, { pet_name: "Luna", pet_type: "cat" }, "Quiero consulta para Luna").pet_name).toBe("Luna");
  expect(selectCurrentPet({ step: STEPS.AWAITING_PET_NAME }, { pet_name: "Luna", pet_type: "cat" }, "Toby")).toEqual({ pet_name: "Toby", pet_type: null });
});

test("an unrelated turn does not replace the selected pet with a name from history", () => {
  expect(selectCurrentPet({ pet_name: "Toby", pet_type: "dog" }, { pet_name: "Luna", pet_type: "cat" }, "mañana a las 12")).toEqual({ pet_name: "Toby", pet_type: "dog" });
});

test("changing the pet in a confirmation must revalidate instead of confirming the old pet", () => {
  expect(confirmsSelectedPet("Sí, para Michi", "Luna")).toBe(false);
  expect(confirmsSelectedPet("Sí, para Luna", "Luna")).toBe(true);
  expect(confirmsSelectedPet("Sí, confirmo", "Luna")).toBe(true);
});
