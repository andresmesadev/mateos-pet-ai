jest.mock("../../services/appointment.service", () => ({ getUserAppointments: jest.fn(), cancelAppointment: jest.fn(),
  formatAppointmentListLine: a => `${a.petName} ${a.serviceType}`,
  mapDbServiceTypeToSession: s => s === "grooming" ? "bath_grooming" : "veterinary_consultation" }));
const appointments = require("../../services/appointment.service");
const { handleAppointmentManagement: manage } = require("../../services/conversation-management.service");
const { STEPS } = require("../../services/domain/booking-steps");
const options = { userId: "owner", tenantId: "tenant", now: new Date("2026-10-10T12:00:00Z") };
const rows = [{ id: "a1", petName: "Akiles", serviceType: "vet", date: new Date("2026-10-13T17:00:00Z"), petType: "dog" },
  { id: "a2", petName: "Matías", serviceType: "grooming", date: new Date("2026-10-13T16:00:00Z"), petType: "dog" }];
beforeEach(() => { jest.clearAllMocks(); appointments.getUserAppointments.mockResolvedValue(rows); });
test("ambiguous cancellation lists pets and writes nothing", async () => {
  const answer = await manage({ ...options, action: "cancel_appointment", userMessage: "Cancela mi cita" });
  expect(answer.step).toBe(STEPS.AWAITING_APPOINTMENT_SELECTION);
  expect(answer.reply).toContain("Akiles"); expect(answer.reply).toContain("Matías");
  expect(appointments.cancelAppointment).not.toHaveBeenCalled();
});
test("selection is restricted to stored candidates and current owner", async () => {
  const answer = await manage({ ...options, session: { step: STEPS.AWAITING_APPOINTMENT_SELECTION, management_action: "cancel_appointment", management_candidates: ["a2", "a1"] }, userMessage: "1" });
  expect(answer.sessionPatch.management_appointment_id).toBe("a2");
  expect(answer.step).toBe(STEPS.AWAITING_MANAGEMENT_CONFIRM);
  expect(appointments.getUserAppointments).toHaveBeenCalledWith("owner", { tenantId: "tenant", limit: 50 });
  expect(appointments.cancelAppointment).not.toHaveBeenCalled();
});
test("No confirmo does not cancel", async () => {
  await manage({ ...options, session: { step: STEPS.AWAITING_MANAGEMENT_CONFIRM, management_appointment_id: "a1" }, userMessage: "No confirmo" });
  expect(appointments.cancelAppointment).not.toHaveBeenCalled();
});
test("confirmed cancellation targets exact authorized appointment", async () => {
  appointments.cancelAppointment.mockResolvedValue(rows[1]);
  await manage({ ...options, session: { step: STEPS.AWAITING_MANAGEMENT_CONFIRM, management_appointment_id: "a2" }, userMessage: "Sí, confirmo" });
  expect(appointments.cancelAppointment).toHaveBeenCalledWith("owner", "a2", "tenant");
});
test("reschedule collects destination without cancelling original", async () => {
  const answer = await manage({ ...options, action: "reschedule_appointment", userMessage: "Reprograma la cita de Matías" });
  expect(answer.sessionPatch.reschedule_appointment_id).toBe("a2");
  expect(answer.reply).toContain("original sigue reservada");
  expect(appointments.cancelAppointment).not.toHaveBeenCalled();
});
test("listing appointments preserves booking draft step", async () => {
  const answer = await manage({ ...options, action: "query_appointments", session: { step: STEPS.AWAITING_PET_NAME, requested_service: "bath_grooming" } });
  expect(answer.step).toBe(STEPS.AWAITING_PET_NAME);
  expect(answer.sessionPatch).toEqual({});
});
