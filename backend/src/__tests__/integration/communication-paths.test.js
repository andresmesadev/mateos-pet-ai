/**
 * Entregable 3.1 — Comunicación: camino real HTTP → caso de uso →
 * persistencia para el envío manual y las escalaciones. Prisma se mockea a
 * nivel de cliente; el resto de la cadena (rutas, casos de uso, adaptadores)
 * es la real — mismo criterio ya aplicado en puente-money-paths.test.js.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  conversation: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  message: { create: jest.fn(), findMany: jest.fn() },
  channel: { findFirst: jest.fn() },
}));

jest.mock("../../services/whatsapp-api.service", () => ({
  sendWhatsAppMessage: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { sendWhatsAppMessage } = require("../../services/whatsapp-api.service");
const conversationsRoutes = require("../../routes/dashboard/conversations.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: "tenant-a" };
    req.actor = { type: "admin", email: "admin@example.com", name: "Administrador" };
    next();
  });
  app.use("/api/dashboard", conversationsRoutes);
  return app;
}

let current;
beforeEach(() => {
  jest.clearAllMocks();
  current = { id: "conv-1", tenantId: "tenant-a", userId: "user-1", status: "esperando_humano",
    assignedActorId: "admin:admin@example.com", controlVersion: 0, updatedAt: new Date(),
    user: { phone: "573000000000" }, sessionData: {} };
  prisma.conversation.findFirst.mockImplementation(async () => current);
  prisma.conversation.findUnique.mockImplementation(async () => current);
  prisma.conversation.findMany.mockResolvedValue([]);
  prisma.message.findMany.mockResolvedValue([]);
  prisma.conversation.updateMany.mockImplementation(async ({ data }) => {
    current = { ...current, ...data, controlVersion: current.controlVersion + 1 };
    return { count: 1 };
  });
});

describe("POST /conversations/:id/send — Enviar Mensaje con conversationId explícito", () => {
  test("envía por el proveedor y persiste con origin=agente en la conversación exacta de la URL", async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: "conv-1",
      userId: "user-1",
      tenantId: "tenant-a",
      user: { phone: "573000000000" },
    });
    prisma.channel.findFirst.mockResolvedValue({ id: "ch-1", type: "whatsapp", active: true });
    sendWhatsAppMessage.mockResolvedValue({ messages: [{ id: "wamid.1" }] });
    let created;
    prisma.message.create.mockImplementation(async ({ data }) => {
      created = data;
      return { id: "msg-1", createdAt: new Date(), ...data };
    });

    const res = await request(buildApp())
      .post("/api/dashboard/conversations/conv-1/send")
      .send({ message: "hola desde el operador", expectedVersion: 0 });

    expect(res.status).toBe(200);
    expect(sendWhatsAppMessage).toHaveBeenCalledWith("573000000000", "hola desde el operador");
    expect(created.conversationId).toBe("conv-1");
    expect(created.origin).toBe("agente");
    expect(created.role).toBe("assistant");
  });

  test("sin Canal activo, responde 502 y no persiste nada", async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: "conv-1",
      userId: "user-1",
      tenantId: "tenant-a",
      user: { phone: "573000000000" },
    });
    prisma.channel.findFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/dashboard/conversations/conv-1/send")
      .send({ message: "hola", expectedVersion: 0 });

    expect(res.status).toBe(502);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  test("si el proveedor falla, no persiste ningún Message (todo o nada)", async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: "conv-1",
      userId: "user-1",
      tenantId: "tenant-a",
      user: { phone: "573000000000" },
    });
    prisma.channel.findFirst.mockResolvedValue({ id: "ch-1", type: "whatsapp", active: true });
    sendWhatsAppMessage.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/dashboard/conversations/conv-1/send")
      .send({ message: "hola", expectedVersion: 0 });

    expect(res.status).toBe(502);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});

describe("GET/PATCH /escalations — evolución de Conversation.status", () => {
  test("lista conversaciones con status=esperando_humano", async () => {
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: "conv-2",
        userId: "user-2",
        status: "esperando_humano",
        updatedAt: new Date(),
        sessionData: { pet_name: "Firulais" },
        user: { phone: "573000000001" },
        messages: [{ content: "necesito ayuda", createdAt: new Date() }],
      },
    ]);

    const res = await request(buildApp()).get("/api/dashboard/escalations");

    expect(res.status).toBe(200);
    expect(res.body[0].requiresHumanAttention).toBe(true);
    expect(res.body[0].petName).toBe("Firulais");
  });

  test("resuelve una escalación y libera el responsable con versión comprobada", async () => {
    current = { ...current, id: "conv-2" };
    const res = await request(buildApp()).patch("/api/dashboard/escalations/conv-2/resolve").send({ expectedVersion: 0 });
    expect(res.status).toBe(200);
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "conv-2", tenantId: "tenant-a", controlVersion: 0 },
      data: expect.objectContaining({ status: "activa", assignedActorId: null, controlVersion: { increment: 1 } }),
    }));
    expect(res.body.conversation.requires_human_attention).toBe(false);
    expect(res.body.conversation.controlVersion).toBe(1);
  });

  test("resolver una conversación ya activa es idempotente", async () => {
    current = { ...current, id: "conv-3", status: "activa", assignedActorId: null };
    const res = await request(buildApp()).patch("/api/dashboard/escalations/conv-3/resolve").send({ expectedVersion: 0 });
    expect(res.status).toBe(200);
    expect(prisma.conversation.updateMany).not.toHaveBeenCalled();
  });

  test("resolver una conversación inexistente responde 404", async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);

    const res = await request(buildApp()).patch("/api/dashboard/escalations/no-existe/resolve");

    expect(res.status).toBe(404);
  });
});
