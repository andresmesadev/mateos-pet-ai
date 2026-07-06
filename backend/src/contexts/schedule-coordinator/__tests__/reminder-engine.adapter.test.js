jest.mock("../../../services/reminder.service", () => ({
  sendReminder: jest.fn(),
  markReminderSent: jest.fn(),
  sendVaccineReminder: jest.fn(),
  markVaccineReminderSent: jest.fn(),
  sendDewormingReminder: jest.fn(),
  markDewormingReminderSent: jest.fn(),
  sendGroomingReminder: jest.fn(),
  markGroomingReminderSent: jest.fn(),
  sendFollowUp: jest.fn(),
  markFollowUpSent: jest.fn(),
}));

const reminderService = require("../../../services/reminder.service");
const { ReminderEngineAdapter } = require("../infrastructure/engine/reminder-engine.adapter");

beforeEach(() => jest.clearAllMocks());

describe("ReminderEngineAdapter", () => {
  test("sendAndMarkAppointmentReminder: marca solo si el envío fue confirmado", async () => {
    reminderService.sendReminder.mockResolvedValue(true);
    const adapter = new ReminderEngineAdapter();

    const sent = await adapter.sendAndMarkAppointmentReminder({ id: "appt-1" });

    expect(sent).toBe(true);
    expect(reminderService.markReminderSent).toHaveBeenCalledWith("appt-1");
  });

  test("sendAndMarkAppointmentReminder: no marca si el envío no fue confirmado", async () => {
    reminderService.sendReminder.mockResolvedValue(false);
    const adapter = new ReminderEngineAdapter();

    const sent = await adapter.sendAndMarkAppointmentReminder({ id: "appt-2" });

    expect(sent).toBe(false);
    expect(reminderService.markReminderSent).not.toHaveBeenCalled();
  });

  test("sendAndMarkVaccineReminder: delega en sendVaccineReminder(record, record.pet.owner)", async () => {
    reminderService.sendVaccineReminder.mockResolvedValue(true);
    const adapter = new ReminderEngineAdapter();
    const record = { id: "rec-1", pet: { owner: { id: "user-1" } } };

    await adapter.sendAndMarkVaccineReminder(record);

    expect(reminderService.sendVaccineReminder).toHaveBeenCalledWith(record, record.pet.owner);
    expect(reminderService.markVaccineReminderSent).toHaveBeenCalledWith("rec-1");
  });

  test("sendAndMarkDewormingReminder / sendAndMarkGroomingReminder / sendAndMarkFollowUp: envuelven sus pares existentes", async () => {
    reminderService.sendDewormingReminder.mockResolvedValue(true);
    reminderService.sendGroomingReminder.mockResolvedValue(true);
    reminderService.sendFollowUp.mockResolvedValue(true);
    const adapter = new ReminderEngineAdapter();

    await adapter.sendAndMarkDewormingReminder({ id: "d-1" });
    await adapter.sendAndMarkGroomingReminder({ id: "g-1" });
    await adapter.sendAndMarkFollowUp({ id: "f-1" });

    expect(reminderService.markDewormingReminderSent).toHaveBeenCalledWith("d-1");
    expect(reminderService.markGroomingReminderSent).toHaveBeenCalledWith("g-1");
    expect(reminderService.markFollowUpSent).toHaveBeenCalledWith("f-1");
  });
});
