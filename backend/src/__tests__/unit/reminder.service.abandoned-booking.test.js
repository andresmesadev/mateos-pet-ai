/**
 * Mejora post-Fase 8 (2026-09-08) — recordatorio de wizard de reserva
 * abandonado. Cubre las 4 funciones nuevas de reminder.service.js:
 * getAbandonedBookingConversations, buildAbandonedBookingReminderMessage,
 * sendAbandonedBookingReminder, markAbandonedBookingReminderSent.
 */
jest.mock("../../lib/prisma", () => ({
  conversation: { findMany: jest.fn(), update: jest.fn() },
}));
jest.mock("../../contexts/communication", () => ({ sendMessage: jest.fn() }));

const prisma = require("../../lib/prisma");
const { sendMessage } = require("../../contexts/communication");
const {
  getAbandonedBookingConversations,
  buildAbandonedBookingReminderMessage,
  sendAbandonedBookingReminder,
  markAbandonedBookingReminderSent,
} = require("../../services/reminder.service");
const { STEPS } = require("../../services/conversation.service");

beforeEach(() => jest.clearAllMocks());

describe("getAbandonedBookingConversations", () => {
  test("exige tenantId (mismo criterio tenant-blind que el resto del archivo)", async () => {
    await expect(getAbandonedBookingConversations(null)).rejects.toThrow("tenantId is required");
    expect(prisma.conversation.findMany).not.toHaveBeenCalled();
  });

  test("filtra por status activa, step de reserva, abandonReminderSent=false y ventana 30-90 min", async () => {
    prisma.conversation.findMany.mockResolvedValue([]);

    await getAbandonedBookingConversations("tenant-1");

    const call = prisma.conversation.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-1");
    expect(call.where.status).toBe("activa");
    expect(call.where.abandonReminderSent).toBe(false);
    expect(call.where.step.in).toContain(STEPS.AWAITING_PET_NAME);
    expect(call.where.step.in).toContain(STEPS.AWAITING_DATE_TIME);
    expect(call.where.step.in).not.toContain(STEPS.COMPLETED);
    const { gte, lte } = call.where.updatedAt;
    const spanMinutes = (lte.getTime() - gte.getTime()) / 60000;
    expect(spanMinutes).toBeCloseTo(60, 0); // 90 - 30
  });
});

describe("buildAbandonedBookingReminderMessage", () => {
  test("con pet_name en sessionData, lo incluye en el mensaje", () => {
    const msg = buildAbandonedBookingReminderMessage({ sessionData: { pet_name: "Firulais" } });
    expect(msg).toContain("Firulais");
  });

  test("sin pet_name, el mensaje sigue siendo válido (sin referencia rota)", () => {
    const msg = buildAbandonedBookingReminderMessage({ sessionData: {} });
    expect(msg).toContain("¿seguimos?");
    expect(msg).not.toContain("undefined");
    expect(msg).not.toContain("null");
  });
});

describe("sendAbandonedBookingReminder", () => {
  test("sin phone/userId, no envía nada", async () => {
    const sent = await sendAbandonedBookingReminder({ id: "conv-1", user: {} });
    expect(sent).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test("con datos completos, envía por Comunicación con conversationId explícito", async () => {
    sendMessage.mockResolvedValue({ message: {} });

    const sent = await sendAbandonedBookingReminder({
      id: "conv-1",
      tenantId: "tenant-1",
      sessionData: { pet_name: "Firulais" },
      user: { id: "user-1", phone: "573000000000" },
    });

    expect(sent).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        conversationId: "conv-1",
        phone: "573000000000",
        origin: "sistema",
      })
    );
  });

  test("si sendMessage falla, retorna false sin lanzar", async () => {
    sendMessage.mockRejectedValue(new Error("proveedor caído"));

    const sent = await sendAbandonedBookingReminder({
      id: "conv-1",
      user: { id: "user-1", phone: "573000000000" },
    });

    expect(sent).toBe(false);
  });
});

describe("markAbandonedBookingReminderSent", () => {
  test("marca abandonReminderSent=true en la conversación", async () => {
    await markAbandonedBookingReminderSent("conv-1");
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { abandonReminderSent: true },
    });
  });
});
