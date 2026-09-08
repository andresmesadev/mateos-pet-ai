/**
 * Mejora post-Fase 8 (2026-09-08) — recordatorio de wizard de reserva
 * abandonado. Verifica que jobs/abandoned-conversation.job.js reutiliza
 * exactamente el mismo wiring que reminder.job.js (tenant activo por tenant
 * activo, Coordinador de Agenda IA, reminderType "abandoned_booking") — ver
 * reminder-job-schedule-coordinator-wiring.test.js para el equivalente del
 * job existente.
 */
jest.mock("../../services/reminder.service", () => ({
  getAbandonedBookingConversations: jest.fn(),
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
const { runAbandonedConversationSweep } = require("../../jobs/abandoned-conversation.job");

const TENANT_A = "tenant-a";

beforeEach(() => {
  jest.clearAllMocks();
  listActiveTenants.mockResolvedValue([{ id: TENANT_A }]);
  reminderService.getAbandonedBookingConversations.mockResolvedValue([]);
});

describe("runAbandonedConversationSweep", () => {
  test("sin tenants activos: no procesa nada y retorna conteos en cero", async () => {
    listActiveTenants.mockResolvedValue([]);

    const result = await runAbandonedConversationSweep();

    expect(scheduleCoordinator.resolveActiveCoordinator).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 0, sent: 0 });
  });

  test("sin Coordinador activo para el tenant: no procesa ninguna conversación", async () => {
    scheduleCoordinator.resolveActiveCoordinator.mockResolvedValue(null);
    reminderService.getAbandonedBookingConversations.mockResolvedValue([{ id: "conv-1" }]);

    const result = await runAbandonedConversationSweep();

    expect(scheduleCoordinator.resolveActiveCoordinator).toHaveBeenCalledWith(TENANT_A);
    expect(scheduleCoordinator.processReminder).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 0, sent: 0 });
  });

  test("con Coordinador activo: procesa cada conversación abandonada con reminderType abandoned_booking", async () => {
    scheduleCoordinator.resolveActiveCoordinator.mockResolvedValue({ id: "de-coord-1", status: "activo" });
    reminderService.getAbandonedBookingConversations.mockResolvedValue([{ id: "conv-1" }]);
    scheduleCoordinator.processReminder.mockResolvedValue({ sent: true });

    const result = await runAbandonedConversationSweep();

    expect(reminderService.getAbandonedBookingConversations).toHaveBeenCalledWith(TENANT_A);
    expect(scheduleCoordinator.processReminder).toHaveBeenCalledWith({
      digitalEmployeeId: "de-coord-1",
      reminderType: "abandoned_booking",
      entity: { id: "conv-1" },
    });
    expect(result).toEqual({ total: 1, sent: 1 });
  });

  test("fallo de processReminder en una conversación no detiene el procesamiento de las demás", async () => {
    scheduleCoordinator.resolveActiveCoordinator.mockResolvedValue({ id: "de-coord-1", status: "activo" });
    reminderService.getAbandonedBookingConversations.mockResolvedValue([{ id: "conv-1" }, { id: "conv-2" }]);
    scheduleCoordinator.processReminder
      .mockRejectedValueOnce(new Error("fallo inesperado"))
      .mockResolvedValueOnce({ sent: true });

    const result = await runAbandonedConversationSweep();

    expect(scheduleCoordinator.processReminder).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ total: 2, sent: 1 });
  });

  test("fallo de un tenant completo no detiene el procesamiento de los demás tenants", async () => {
    listActiveTenants.mockResolvedValue([{ id: "tenant-a" }, { id: "tenant-b" }]);
    scheduleCoordinator.resolveActiveCoordinator
      .mockRejectedValueOnce(new Error("fallo inesperado del tenant A"))
      .mockResolvedValueOnce({ id: "de-coord-b", status: "activo" });
    reminderService.getAbandonedBookingConversations.mockResolvedValue([{ id: "conv-b1" }]);
    scheduleCoordinator.processReminder.mockResolvedValue({ sent: true });

    const result = await runAbandonedConversationSweep();

    expect(result).toEqual({ total: 1, sent: 1 });
  });
});
