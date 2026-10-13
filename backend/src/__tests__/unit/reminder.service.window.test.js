jest.mock("../../lib/prisma", () => ({ appointment: { update: jest.fn() } }));
jest.mock("../../contexts/communication", () => ({ sendMessage: jest.fn() }));
const { sendMessage } = require("../../contexts/communication");
const prisma = require("../../lib/prisma");
const { ReminderEngineAdapter } = require("../../contexts/schedule-coordinator/infrastructure/engine/reminder-engine.adapter");
const { sendAbandonedBookingReminder } = require("../../services/reminder.service");
const appointment = { id: "appointment", tenantId: "tenant", userId: "owner", user: { id: "owner", phone: "test" }, petName: "Pet", serviceType: "vet", date: new Date("2026-10-14T17:00:00Z") };

beforeEach(() => jest.clearAllMocks());
test("omitted window-closed reminder never marks appointment sent", async () => {
  sendMessage.mockResolvedValue({ message: null, skipped: true, reason: "whatsapp_window_closed" });
  expect(await new ReminderEngineAdapter().sendAndMarkAppointmentReminder(appointment)).toBe(false);
  expect(prisma.appointment.update).not.toHaveBeenCalled();
});
test("accepted notification keeps the existing mark contract", async () => {
  sendMessage.mockResolvedValue({ message: { id: "accepted" } });
  expect(await new ReminderEngineAdapter().sendAndMarkAppointmentReminder(appointment)).toBe(true);
  expect(prisma.appointment.update).toHaveBeenCalledWith({ where: { id: "appointment" }, data: { reminderSent: true } });
});
test.each([undefined, null, {}, { message: null }])("an incomplete delivery result never marks sent: %j", async result => {
  sendMessage.mockResolvedValue(result);
  expect(await new ReminderEngineAdapter().sendAndMarkAppointmentReminder(appointment)).toBe(false);
  expect(prisma.appointment.update).not.toHaveBeenCalled();
});
test("abandoned booking notification also recognizes omitted delivery", async () => {
  sendMessage.mockResolvedValue({ message: null, skipped: true, reason: "whatsapp_window_closed" });
  expect(await sendAbandonedBookingReminder({ id: "conversation", tenantId: "tenant", userId: "owner", user: { phone: "test" }, sessionData: {} })).toBe(false);
});
