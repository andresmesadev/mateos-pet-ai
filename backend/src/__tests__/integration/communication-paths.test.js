/**
 * Entregable 3.1 — Comunicación: camino real HTTP → caso de uso →
 * persistencia para el envío manual y las escalaciones. Prisma se mockea a
 * nivel de cliente; el resto de la cadena (rutas, casos de uso, adaptadores)
 * es la real — mismo criterio ya aplicado en puente-money-paths.test.js.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  conversation: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
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
    next();
  });
  app.use("/api/dashboard", conversationsRoutes);
  return app;
}

beforeEach(() => jest.clearAllMocks());

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
      .send({ message: "hola desde el operador" });

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
      .send({ message: "hola" });

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
      .send({ message: "hola" });

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

  test("resuelve una escalación: status vuelve a activa", async () => {
    // Primera llamada (findById dentro del caso de uso): aún escalada.
    // Segunda llamada (la ruta releyendo tras resolver): ya activa.
    prisma.conversation.findUnique
      .mockResolvedValueOnce({ id: "conv-2", status: "esperando_humano" })
      .mockResolvedValueOnce({
        id: "conv-2",
        status: "activa",
        updatedAt: new Date(),
        sessionData: {},
        user: { phone: "573000000001" },
        messages: [],
      });
    prisma.conversation.update.mockImplementation(async ({ data }) => ({
      id: "conv-2",
      status: data.status,
      updatedAt: new Date(),
      sessionData: {},
      user: { phone: "573000000001" },
      messages: [],
    }));

    const res = await request(buildApp()).patch("/api/dashboard/escalations/conv-2/resolve");

    expect(res.status).toBe(200);
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "activa" } })
    );
    expect(res.body.requiresHumanAttention).toBe(false);
  });

  test("resolver una conversación ya no escalada es idempotente (200, no error)", async () => {
    prisma.conversation.findUnique.mockResolvedValue({ id: "conv-3", status: "activa" });

    const res = await request(buildApp()).patch("/api/dashboard/escalations/conv-3/resolve");

    expect(res.status).toBe(200);
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  test("resolver una conversación inexistente responde 404", async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);

    const res = await request(buildApp()).patch("/api/dashboard/escalations/no-existe/resolve");

    expect(res.status).toBe(404);
  });
});
