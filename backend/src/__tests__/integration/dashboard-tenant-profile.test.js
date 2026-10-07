const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({ tenant: { findUnique: jest.fn(), update: jest.fn() } }));
jest.mock("../../services/business-config.service", () => ({ updateActiveModules: jest.fn(), updateCommissionSplitRate: jest.fn() }));
const prisma = require("../../lib/prisma");
const routes = require("../../routes/dashboard/tenant.routes");

function app(tenantId = "establishment-a") {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => { req.tenant = { tenantId, isSuperAdmin: false }; req.actor = { type: "admin" }; next(); });
  instance.use("/api/dashboard", routes);
  return instance;
}
beforeEach(() => { jest.clearAllMocks(); prisma.tenant.update.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })); });

test("guarda los datos del negocio sin cambiar el identificador del canal del establecimiento autenticado", async () => {
  const response = await request(app()).put("/api/dashboard/tenant/profile").send({ tenantId: "another-tenant", name: "  Clínica Prueba  ", email: " prueba@example.com ", address: " Calle 123, Bogotá ", description: " Atención veterinaria " });
  expect(response.status).toBe(200);
  expect(prisma.tenant.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "establishment-a" }, data: { name: "Clínica Prueba", email: "prueba@example.com", address: "Calle 123, Bogotá", description: "Atención veterinaria" } }));
  expect(prisma.tenant.update.mock.calls[0][0].data).not.toHaveProperty("phone");
});

test("permite vaciar campos opcionales y no altera campos no enviados", async () => {
  const response = await request(app()).put("/api/dashboard/tenant/profile").send({ address: " ", description: null, email: null });
  expect(response.status).toBe(200);
  expect(prisma.tenant.update.mock.calls[0][0].data).toEqual({ address: null, description: null, email: null });
});

test.each([{ name: " " }, { phone: "" }, { phone: null }, { name: {} }, { address: 123 }, { email: "correo inválido" }, { description: "x".repeat(2001) }, { contactPhone: 573001234567 }, { contactPhone: {} }, { contactPhone: "abc1234567" }, { contactPhone: "300+1234567" }, { contactPhone: "123456" }, { contactPhone: "+1234567890123456" }, { contactPhone: " ".repeat(41) + "1234567" }])("rechaza datos inválidos antes de escribir: %j", async (body) => {
  const response = await request(app()).put("/api/dashboard/tenant/profile").send(body);
  expect(response.status).toBe(400);
  expect(prisma.tenant.update).not.toHaveBeenCalled();
});

test.each([[" +57 (300) 123-45.67 ", "+573001234567"], ["601 123 4567", "6011234567"], ["1234567", "1234567"], ["+123456789012345", "+123456789012345"], [null, null], ["", null], ["  ", null]])("normaliza el contacto %j sin modificar el canal", async (input, expected) => {
  const response = await request(app()).put("/api/dashboard/tenant/profile").send({ contactPhone: input, tenantId: "another-tenant" });
  expect(response.status).toBe(200);
  expect(response.body.contactPhone).toBe(expected);
  expect(prisma.tenant.update.mock.calls[0][0]).toEqual(expect.objectContaining({ where: { id: "establishment-a" }, data: { contactPhone: expected } }));
});

test("consulta ambos identificadores en el perfil administrativo", async () => {
  prisma.tenant.findUnique.mockResolvedValue({ id: "establishment-a", phone: "meta-channel-id", contactPhone: "+573001234567" });
  const response = await request(app()).get("/api/dashboard/tenant/profile");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ id: "establishment-a", phone: "meta-channel-id", contactPhone: "+573001234567" });
  expect(prisma.tenant.findUnique.mock.calls[0][0]).toEqual(expect.objectContaining({ where: { id: "establishment-a" }, select: expect.objectContaining({ phone: true, contactPhone: true }) }));
});

test("el perfil operativo no expone el contacto administrativo ni el identificador del canal", async () => {
  prisma.tenant.findUnique.mockResolvedValue({ id: "establishment-a", name: "Prueba", activeModules: ["veterinary"], phone: "meta-channel-id", contactPhone: "+573001234567" });
  const instance = express();
  instance.use((req, _res, next) => { req.tenant = { tenantId: "establishment-a" }; req.actor = { type: "staff" }; next(); });
  instance.use("/api/dashboard", routes);
  const response = await request(instance).get("/api/dashboard/tenant/profile");
  expect(response.body).toEqual({ id: "establishment-a", name: "Prueba", activeModules: ["veterinary"] });
});

test("protege el identificador que resuelve mensajes entrantes de WhatsApp", async () => {
  const response = await request(app()).put("/api/dashboard/tenant/profile").send({ phone: "+573001234567" });
  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(/identificador del canal de WhatsApp/);
  expect(prisma.tenant.update).not.toHaveBeenCalled();
});

test("sin establecimiento autenticado no escribe", async () => {
  const response = await request(app(null)).put("/api/dashboard/tenant/profile").send({ name: "Prueba" });
  expect(response.status).toBe(403);
  expect(prisma.tenant.update).not.toHaveBeenCalled();
});
