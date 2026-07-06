/**
 * Entregable 3.5 — Coordinador de Agenda IA: verifica que reminder.job.js
 * delega el envío + marcado de cada recordatorio en
 * contexts/schedule-coordinator.processReminder, en lugar de invocar
 * directamente reminder.service.js, preservando el contrato de retorno
 * (conteos por categoría) sin cambios.
 */
jest.mock("../../services/reminder.service", () => ({
  getAppointmentsForReminder: jest.fn(),
  getUpcomingVaccineReminders: jest.fn(),
  getUpcomingDewormingReminders: jest.fn(),
  getUpcomingGroomingReminders: jest.fn(),
  getConsultationsForFollowUp: jest.fn(),
}));

jest.mock("../../contexts/schedule-coordinator", () => ({
  resolveActiveCoordinator: jest.fn(),
  processReminder: jest.fn(),
}));

const reminderService = require("../../services/reminder.service");
const scheduleCoordinator = require("../../contexts/schedule-coordinator");
const { processReminders } = require("../../jobs/reminder.job");

beforeEach(() => {
  jest.clearAllMocks();
  reminderService.getAppointmentsForReminder.mockResolvedValue([]);
  reminderService.getUpcomingVaccineReminders.mockResolvedValue([]);
  reminderService.getUpcomingDewormingReminders.mockResolvedValue([]);
  reminderService.getUpcomingGroomingReminders.mockResolvedValue([]);
  reminderService.getConsultationsForFollowUp.mockResolvedValue([]);
});

describe("processReminders (wiring Coordinador de Agenda IA)", () => {
  test("sin Coordinador activo: no procesa ningún recordatorio y retorna conteos en cero", async () => {
    scheduleCoordinator.resolveActiveCoordinator.mockResolvedValue(null);
    reminderService.getAppointmentsForReminder.mockResolvedValue([{ id: "appt-1" }]);

    const result = await processReminders();

    expect(scheduleCoordinator.processReminder).not.toHaveBeenCalled();
    expect(result.appointments).toEqual({ total: 0, sent: 0 });
  });

  test("Coordinador no configurado (error): no procesa y no propaga la excepción", async () => {
    scheduleCoordinator.resolveActiveCoordinator.mockRejectedValue(new Error("no existe"));

    await expect(processReminders()).resolves.toBeDefined();
    expect(scheduleCoordinator.processReminder).not.toHaveBeenCalled();
  });

  test("con Coordinador activo: procesa cada recordatorio de cada categoría con el mismo digitalEmployeeId", async () => {
    scheduleCoordinator.resolveActiveCoordinator.mockResolvedValue({ id: "de-coord-1", status: "activo" });
    reminderService.getAppointmentsForReminder.mockResolvedValue([{ id: "appt-1" }]);
    reminderService.getUpcomingVaccineReminders.mockResolvedValue([{ id: "vac-1" }]);
    scheduleCoordinator.processReminder.mockResolvedValue({ sent: true });

    const result = await processReminders();

    expect(scheduleCoordinator.processReminder).toHaveBeenCalledWith({
      digitalEmployeeId: "de-coord-1",
      reminderType: "appointment",
      entity: { id: "appt-1" },
    });
    expect(scheduleCoordinator.processReminder).toHaveBeenCalledWith({
      digitalEmployeeId: "de-coord-1",
      reminderType: "vaccine",
      entity: { id: "vac-1" },
    });
    expect(result.appointments).toEqual({ total: 1, sent: 1 });
    expect(result.vaccines).toEqual({ total: 1, sent: 1 });
  });

  test("fallo de processReminder en un ítem no detiene el procesamiento de los demás", async () => {
    scheduleCoordinator.resolveActiveCoordinator.mockResolvedValue({ id: "de-coord-1", status: "activo" });
    reminderService.getAppointmentsForReminder.mockResolvedValue([{ id: "appt-1" }, { id: "appt-2" }]);
    scheduleCoordinator.processReminder
      .mockRejectedValueOnce(new Error("fallo inesperado"))
      .mockResolvedValueOnce({ sent: true });

    const result = await processReminders();

    expect(scheduleCoordinator.processReminder).toHaveBeenCalledTimes(2); // appt-1 falla, appt-2 se procesa igual
    expect(result.appointments).toEqual({ total: 2, sent: 1 });
  });
});
