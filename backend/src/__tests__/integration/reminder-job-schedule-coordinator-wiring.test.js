/**
 * Entregable 3.5 — Coordinador de Agenda IA: verifica que reminder.job.js
 * delega el envío + marcado de cada recordatorio en
 * contexts/schedule-coordinator.processReminder, en lugar de invocar
 * directamente reminder.service.js, preservando el contrato de retorno
 * (conteos por categoría) sin cambios.
 *
 * Entregable 4.1 (Fase 4) — saneamiento tenant-blind (M4): el job pasó de
 * resolver un único Coordinador global a iterar explícitamente cada tenant
 * activo; estos tests verifican también ese wiring.
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

jest.mock("../../services/tenant.service", () => ({
  listActiveTenants: jest.fn(),
}));

const reminderService = require("../../services/reminder.service");
const scheduleCoordinator = require("../../contexts/schedule-coordinator");
const { listActiveTenants } = require("../../services/tenant.service");
const { processReminders } = require("../../jobs/reminder.job");

const TENANT_A = "tenant-a";

beforeEach(() => {
  jest.clearAllMocks();
  listActiveTenants.mockResolvedValue([{ id: TENANT_A }]);
  reminderService.getAppointmentsForReminder.mockResolvedValue([]);
  reminderService.getUpcomingVaccineReminders.mockResolvedValue([]);
  reminderService.getUpcomingDewormingReminders.mockResolvedValue([]);
  reminderService.getUpcomingGroomingReminders.mockResolvedValue([]);
  reminderService.getConsultationsForFollowUp.mockResolvedValue([]);
});

describe("processReminders (wiring Coordinador de Agenda IA + saneamiento tenant-blind)", () => {
  test("sin tenants activos: no procesa nada y retorna conteos en cero", async () => {
    listActiveTenants.mockResolvedValue([]);

    const result = await processReminders();

    expect(scheduleCoordinator.resolveActiveCoordinator).not.toHaveBeenCalled();
    expect(result.appointments).toEqual({ total: 0, sent: 0 });
  });

  test("sin Coordinador activo para el tenant: no procesa ningún recordatorio y retorna conteos en cero", async () => {
    scheduleCoordinator.resolveActiveCoordinator.mockResolvedValue(null);
    reminderService.getAppointmentsForReminder.mockResolvedValue([{ id: "appt-1" }]);

    const result = await processReminders();

    expect(scheduleCoordinator.resolveActiveCoordinator).toHaveBeenCalledWith(TENANT_A);
    expect(scheduleCoordinator.processReminder).not.toHaveBeenCalled();
    expect(result.appointments).toEqual({ total: 0, sent: 0 });
  });

  test("Coordinador no configurado (error) para un tenant: no procesa ese tenant y no propaga la excepción", async () => {
    scheduleCoordinator.resolveActiveCoordinator.mockRejectedValue(new Error("no existe"));

    await expect(processReminders()).resolves.toBeDefined();
    expect(scheduleCoordinator.processReminder).not.toHaveBeenCalled();
  });

  test("con Coordinador activo: procesa cada recordatorio de cada categoría, con el tenantId correcto, con el mismo digitalEmployeeId", async () => {
    scheduleCoordinator.resolveActiveCoordinator.mockResolvedValue({ id: "de-coord-1", status: "activo" });
    reminderService.getAppointmentsForReminder.mockResolvedValue([{ id: "appt-1" }]);
    reminderService.getUpcomingVaccineReminders.mockResolvedValue([{ id: "vac-1" }]);
    scheduleCoordinator.processReminder.mockResolvedValue({ sent: true });

    const result = await processReminders();

    expect(reminderService.getAppointmentsForReminder).toHaveBeenCalledWith(TENANT_A);
    expect(reminderService.getUpcomingVaccineReminders).toHaveBeenCalledWith(TENANT_A);
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

  test("fallo de un tenant completo no detiene el procesamiento de los demás tenants", async () => {
    listActiveTenants.mockResolvedValue([{ id: "tenant-a" }, { id: "tenant-b" }]);
    scheduleCoordinator.resolveActiveCoordinator
      .mockRejectedValueOnce(new Error("fallo inesperado del tenant A"))
      .mockResolvedValueOnce({ id: "de-coord-b", status: "activo" });
    reminderService.getAppointmentsForReminder.mockResolvedValue([{ id: "appt-b1" }]);
    scheduleCoordinator.processReminder.mockResolvedValue({ sent: true });

    const result = await processReminders();

    expect(result.appointments).toEqual({ total: 1, sent: 1 });
  });
});
