const express = require("express");
const request = require("supertest");
jest.mock("../../lib/prisma", () => ({ conversation: { findFirst: jest.fn(), findUnique: jest.fn() } }));
jest.mock("../../services/dashboard-conversation.service", () => ({ listConversations: jest.fn(), getConversationMessages: jest.fn() }));
jest.mock("../../contexts/communication", () => ({ sendMessage: jest.fn(), controlConversation: jest.fn(), listEscalatedConversations: jest.fn() }));
const prisma = require("../../lib/prisma");
const reading = require("../../services/dashboard-conversation.service");
const communication = require("../../contexts/communication");
const router = require("../../routes/dashboard/conversations.routes");
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.tenant = { tenantId: "tenant-a" }; req.actor = { type: "vet", staffId: "vet-a", name: "Dra. Ana" }; next(); });
app.use("/api/dashboard", router);
beforeEach(() => jest.resetAllMocks());

test("el tenant autenticado prevalece sobre la búsqueda y query ajenos", async () => {
  reading.listConversations.mockResolvedValue({ data: [], pagination: { total: 0 } });
  expect((await request(app).get("/api/dashboard/conversations?tenantId=tenant-b&search=Ana&attention=human&page=2")).status).toBe(200);
  expect(reading.listConversations).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", search: "Ana", attention: "human", page: "2" }));
});

test("no se puede leer, resolver o responder al hilo de otro tenant", async () => {
  prisma.conversation.findFirst.mockResolvedValue(null);
  prisma.conversation.findUnique.mockResolvedValue({ id: "foreign", tenantId: "tenant-b", user: { phone: "123" } });
  expect((await request(app).get("/api/dashboard/conversations/foreign/messages")).status).toBe(404);
  expect((await request(app).patch("/api/dashboard/escalations/foreign/resolve")).status).toBe(404);
  expect((await request(app).post("/api/dashboard/conversations/foreign/send").send({ message: "No enviar" })).status).toBe(404);
  expect(reading.getConversationMessages).not.toHaveBeenCalled();
  expect(communication.controlConversation).not.toHaveBeenCalled();
  expect(communication.sendMessage).not.toHaveBeenCalled();
});

test("un fallo del proveedor conserva el contrato de error sin inventar un mensaje guardado", async () => {
  prisma.conversation.findUnique.mockResolvedValue({ id: "own", userId: "owner-a", tenantId: "tenant-a", user: { phone: "123" } });
  communication.sendMessage.mockRejectedValue(new Error("Proveedor simulado inactivo"));
  const result = await request(app).post("/api/dashboard/conversations/own/send").send({ message: "Texto de prueba" });
  expect(result.status).toBe(502); expect(result.body.message).toBeUndefined();
  expect(communication.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", userId: "owner-a", conversationId: "own", content: "Texto de prueba" }));
});
