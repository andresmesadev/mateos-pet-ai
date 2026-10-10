jest.mock("../../lib/prisma", () => ({ appointment: { findFirst: jest.fn(), updateMany: jest.fn() }, $transaction: jest.fn() }));
jest.mock("../../services/availability-db.service", () => ({ isSlotAvailable: jest.fn() }));
jest.mock("../../services/google-calendar.service", () => ({ createCalendarEvent: jest.fn(), cancelCalendarEvent: jest.fn() }));
jest.mock("../../services/reminder.service", () => ({ resetGroomingReminderForPet: jest.fn() }));
const prisma = require("../../lib/prisma");
const availability = require("../../services/availability-db.service");
const { cancelAppointment, rescheduleAppointment } = require("../../services/appointment.service");
const original = { id: "a1", userId: "owner", tenantId: "tenant", serviceType: "vet", status: "pending", date: new Date("2030-01-08T17:00:00Z") };
const options = { userId: "owner", tenantId: "tenant", appointmentId: "a1", date: new Date("2030-01-09T17:00:00Z") };
beforeEach(() => jest.clearAllMocks());
test("cancellation refuses implicit latest appointment", async () => {
  await expect(cancelAppointment("owner")).rejects.toThrow("appointmentId");
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});
test("unowned or inactive appointment cannot be cancelled", async () => {
  prisma.appointment.findFirst.mockResolvedValue(null);
  expect(await cancelAppointment("owner", "foreign", "tenant")).toBeNull();
  expect(prisma.appointment.findFirst.mock.calls[0][0].where).toMatchObject({ id: "foreign", tenantId: "tenant", userId: "owner" });
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});
test("unavailable replacement preserves original without starting a write transaction", async () => {
  prisma.appointment.findFirst.mockResolvedValue(original);
  availability.isSlotAvailable.mockResolvedValue(false);
  await expect(rescheduleAppointment(options)).rejects.toThrow();
  expect(prisma.$transaction).not.toHaveBeenCalled();
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});
test("collision inside transaction never cancels original", async () => {
  prisma.appointment.findFirst.mockResolvedValue(original);
  availability.isSlotAvailable.mockResolvedValue(true);
  const tx = { $queryRaw: jest.fn(), appointment: { findFirst: jest.fn().mockResolvedValueOnce(original).mockResolvedValueOnce({ id: "collision" }), update: jest.fn() } };
  prisma.$transaction.mockImplementation(fn => fn(tx));
  await expect(rescheduleAppointment(options)).rejects.toThrow();
  expect(tx.appointment.update).not.toHaveBeenCalled();
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});
test("successful move updates same ID under lock and excludes itself from availability", async () => {
  prisma.appointment.findFirst.mockResolvedValue(original);
  availability.isSlotAvailable.mockResolvedValue(true);
  const tx = { $queryRaw: jest.fn(), appointment: { findFirst: jest.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(null), update: jest.fn().mockResolvedValue({ ...original, date: options.date }) } };
  prisma.$transaction.mockImplementation(fn => fn(tx));
  expect((await rescheduleAppointment(options)).id).toBe("a1");
  expect(availability.isSlotAvailable).toHaveBeenCalledWith(expect.objectContaining({ excludeAppointmentId: "a1", tenantId: "tenant" }));
  expect(tx.$queryRaw).toHaveBeenCalled();
  expect(tx.appointment.update.mock.calls[0][0].where).toMatchObject({ id: "a1", userId: "owner", tenantId: "tenant", date: original.date });
});
