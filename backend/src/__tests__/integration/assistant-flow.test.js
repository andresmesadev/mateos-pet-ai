// Real adapter + real conversation rules + real session cache; only external I/O is mocked.
jest.mock("../../lib/prisma", () => ({ conversation: { update: jest.fn().mockResolvedValue({}) } }));
jest.mock("../../services/openai.service", () => ({ analyzeMessage: jest.fn(), generateReply: jest.fn() }));
jest.mock("../../services/user.service", () => ({ findOrCreateUser: jest.fn().mockResolvedValue({ id: "owner", tenantId: "tenant", name: "Andrés" }), updateUserNameIfMissing: jest.fn() }));
jest.mock("../../services/pet.service", () => ({ getUserPets: jest.fn().mockResolvedValue([{ name: "Akiles", type: "dog" }]), findPetByNameAndOwner: jest.fn().mockResolvedValue(null), resolveAppointmentPetName: jest.fn(async name => name) }));
jest.mock("../../services/tenant.service", () => ({ getTenantByPhone: jest.fn().mockResolvedValue({ id: "tenant", active: true }) }));
jest.mock("../../services/appointment.service", () => ({ ...jest.requireActual("../../services/appointment.service"), createAppointment: jest.fn(async data => ({ ...data, id: "new" })), checkAppointmentConflict: jest.fn().mockResolvedValue(false), getUserAppointments: jest.fn().mockResolvedValue([]) }));
jest.mock("../../services/availability-db.service", () => ({ findNextAvailableGroomingSlot: jest.fn().mockResolvedValue({ date: "2026-10-13", hour: 11 }), listAvailableSlotsForDate: jest.fn().mockResolvedValue([13]), isSlotAvailable: jest.fn().mockResolvedValue(true) }));
jest.mock("../../services/business-config.service", () => ({ getBusinessHours: jest.fn().mockResolvedValue(null) }));
jest.mock("../../services/conversation-persistence.service", () => ({ findOrCreateConversation: jest.fn(), saveMessage: jest.fn().mockResolvedValue({}), findMessageByExternalId: jest.fn().mockResolvedValue(null), getConversationMessages: jest.fn().mockResolvedValue([]), syncConversationState: jest.fn().mockImplementation(id => require("../../services/memory.service").flushConversationSession(id)) }));
const memory = require("../../services/memory.service");
const persistence = require("../../services/conversation-persistence.service");
const ai = require("../../services/openai.service");
const appointments = require("../../services/appointment.service");
const { processIncomingMessage } = require("../../services/whatsapp.service");
const { STEPS } = require("../../services/domain/booking-steps");
const PHONE = "test-owner";
let serial = 0;
const body = message => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "line" }, messages: [{ id: `test-${++serial}`, from: PHONE, type: "text", text: { body: message } }] } }] }] });
const start = session => {
  const conversation = { id: `conversation-${++serial}`, tenantId: "tenant", status: "activa", step: session.step, intent: "schedule_appointment", sessionData: session };
  memory.hydrateSessionFromConversation(PHONE, conversation);
  persistence.findOrCreateConversation.mockResolvedValue(conversation);
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(new Date("2026-10-10T16:50:00Z"));
  ai.analyzeMessage.mockResolvedValue({ intent: "other" });
});
afterEach(() => jest.useRealTimers());
const grooming = { step: STEPS.AWAITING_GROOMING_SLOT_CONFIRM, pet_name: "Matías", pet_type: "dog", requested_service: "bath_grooming", scheduling_date_key: "2026-10-13", scheduling_hour: 11 };
test("actual incident: availability question keeps Matías grooming draft, not Akiles vet appointments", async () => {
  start(grooming);
  ai.analyzeMessage.mockResolvedValue({ intent: "query_appointments" });
  const answer = await processIncomingMessage(body("¿Para hoy ya no hay?"));
  expect(answer.session.pet_name).toBe("Matías");
  expect(answer.session.requested_service).toBe("bath_grooming");
  expect(answer.session.scheduling_date_key).toBe("2026-10-10");
  expect(answer.session.scheduling_hour).toBe(13);
  expect(appointments.getUserAppointments).not.toHaveBeenCalled();
  expect(appointments.createAppointment).not.toHaveBeenCalled();
});
test("grooming pickup is reviewed first and only saved after explicit final consent", async () => {
  start(grooming);
  await processIncomingMessage(body("Sí"));
  expect(memory.getSession(PHONE, "tenant").step).toBe(STEPS.AWAITING_DOMICILIO);
  await processIncomingMessage(body("Recoger en casa"));
  const unclear = await processIncomingMessage(body("No sé todavía"));
  expect(unclear.session.step).toBe(STEPS.AWAITING_DOMICILIO_ADDRESS);
  const review = await processIncomingMessage(body("Calle 10 # 20-30"));
  expect(review.reply).toContain("Aún no está guardada");
  expect(review.reply).toContain("Calle 10 # 20-30");
  expect(appointments.createAppointment).not.toHaveBeenCalled();
  const saved = await processIncomingMessage(body("Sí, confirmo"));
  expect(appointments.createAppointment).toHaveBeenCalledTimes(1);
  expect(saved.reply).toContain("Dirección de recogida: Calle 10 # 20-30");
});
test.each(["No confirmo", "Necesito saber cuánto cuesta", "No estoy de acuerdo"])("negative or question %s cannot reserve", async text => {
  start({ ...grooming, step: STEPS.AWAITING_CONFIRMATION });
  const answer = await processIncomingMessage(body(text));
  expect(appointments.createAppointment).not.toHaveBeenCalled();
  expect(answer.session.pet_name).toBe("Matías");
});
test("correction to another pet invalidates proposal and asks species, never silently assumes history", async () => {
  start({ ...grooming, pet_name: "Akiles" });
  ai.analyzeMessage.mockResolvedValue({ intent: "schedule_appointment", pet_name: "Matías", pet_type: "dog", requested_service: "bath_grooming" });
  const answer = await processIncomingMessage(body("Sí, pero para Matías"));
  expect(answer.session.step).toBe(STEPS.AWAITING_PET_TYPE);
  expect(answer.session.pet_name).toBe("Matías");
  expect(answer.session.scheduling_date_key).toBeNull();
  expect(appointments.createAppointment).not.toHaveBeenCalled();
});
test("state failure after reservation is persisted must go to review, never invite a duplicate confirmation", async () => {
  start({ ...grooming, step: STEPS.AWAITING_CONFIRMATION, domicilio: false });
  persistence.syncConversationState.mockRejectedValueOnce(new Error("snapshot unavailable"));
  await expect(processIncomingMessage(body("Sí, confirmo"))).rejects.toMatchObject({ operationAccepted: true });
  expect(appointments.createAppointment).toHaveBeenCalledTimes(1);
  expect(persistence.syncConversationState).toHaveBeenCalledTimes(1);
});
test("a pet correction during reschedule cannot silently move the original pet's appointment", async () => {
  start({ ...grooming, pet_name: "Akiles", reschedule_appointment_id: "original" });
  ai.analyzeMessage.mockResolvedValue({ intent: "schedule_appointment", pet_name: "Matías", requested_service: "bath_grooming" });
  const answer = await processIncomingMessage(body("Sí, pero para Matías"));
  expect(answer.reply).toContain("original sigue reservada");
  expect(answer.session.pet_name).toBe("Akiles");
  expect(appointments.createAppointment).not.toHaveBeenCalled();
});
