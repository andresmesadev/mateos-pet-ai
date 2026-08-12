/**
 * Catálogo de Recursos de la API pública v1 (Ecosistema): verifica el gate
 * completo montado como en app.js (publicApiRateLimit + apiKeyAuth +
 * publicApiRoutes) — autenticación, scopes, aislamiento cross-tenant,
 * casos válidos, errores, y respuesta pública sin campos internos.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  apiKey: { findUnique: jest.fn(), update: jest.fn() },
}));

jest.mock("../../contexts/services", () => ({
  listAvailableServices: jest.fn(),
}));

jest.mock("../../contexts/staff", () => ({
  resolveStaffAvailability: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { listAvailableServices } = require("../../contexts/services");
const { resolveStaffAvailability } = require("../../contexts/staff");
const { ReferencedServiceNotFoundError } = require("../../contexts/staff/domain/errors");
const { apiKeyAuth } = require("../../middleware/apiKeyAuth");
const publicApiRoutes = require("../../routes/public-api.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/public", apiKeyAuth, publicApiRoutes);
  return app;
}

const KEY_TENANT_A = {
  id: "key-1",
  tenantId: "tenant-a",
  scopes: ["read:services", "read:availability"],
  revokedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/public/services", () => {
  test("rechaza sin API key con 401", async () => {
    const res = await request(buildApp()).get("/api/public/services");
    expect(res.status).toBe(401);
    expect(listAvailableServices).not.toHaveBeenCalled();
  });

  test("rechaza una key sin el scope read:services con 403", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...KEY_TENANT_A, scopes: ["read:availability"] });
    const res = await request(buildApp()).get("/api/public/services").set("Authorization", "Bearer valida");
    expect(res.status).toBe(403);
    expect(listAvailableServices).not.toHaveBeenCalled();
  });

  test("con key y scope válidos, resuelve el tenantId exclusivamente desde la key, nunca desde query", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    listAvailableServices.mockResolvedValue({
      services: [
        {
          id: "svc-1",
          name: "Baño y corte",
          categoryId: "cat-1",
          duration: 60,
          basePrice: 50000,
          requiresAppointment: true,
          tenantId: "tenant-a",
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const res = await request(buildApp())
      .get("/api/public/services?tenantId=tenant-falsificado")
      .set("Authorization", "Bearer valida");

    expect(res.status).toBe(200);
    expect(listAvailableServices).toHaveBeenCalledWith({ tenantId: "tenant-a", categoryId: null });
  });

  test("la respuesta pública nunca expone tenantId, active, createdAt ni updatedAt", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    listAvailableServices.mockResolvedValue({
      services: [
        {
          id: "svc-1",
          name: "Baño y corte",
          categoryId: "cat-1",
          duration: 60,
          basePrice: 50000,
          requiresAppointment: true,
          tenantId: "tenant-a",
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const res = await request(buildApp()).get("/api/public/services").set("Authorization", "Bearer valida");

    expect(res.body.services).toEqual([
      {
        id: "svc-1",
        name: "Baño y corte",
        categoryId: "cat-1",
        duration: 60,
        basePrice: 50000,
        requiresAppointment: true,
      },
    ]);
  });

  test("propaga categoryId de la query al caso de uso", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    listAvailableServices.mockResolvedValue({ services: [] });

    await request(buildApp())
      .get("/api/public/services?categoryId=cat-9")
      .set("Authorization", "Bearer valida");

    expect(listAvailableServices).toHaveBeenCalledWith({ tenantId: "tenant-a", categoryId: "cat-9" });
  });
});

describe("POST /api/public/availability", () => {
  test("rechaza sin API key con 401", async () => {
    const res = await request(buildApp())
      .post("/api/public/availability")
      .send({ serviceId: "svc-1", rangeStart: "2026-01-01T10:00:00Z", rangeEnd: "2026-01-01T11:00:00Z" });
    expect(res.status).toBe(401);
    expect(resolveStaffAvailability).not.toHaveBeenCalled();
  });

  test("rechaza una key sin el scope read:availability con 403", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...KEY_TENANT_A, scopes: ["read:services"] });
    const res = await request(buildApp())
      .post("/api/public/availability")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-1", rangeStart: "2026-01-01T10:00:00Z", rangeEnd: "2026-01-01T11:00:00Z" });
    expect(res.status).toBe(403);
    expect(resolveStaffAvailability).not.toHaveBeenCalled();
  });

  test("rechaza sin serviceId con 400", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    const res = await request(buildApp())
      .post("/api/public/availability")
      .set("Authorization", "Bearer valida")
      .send({ rangeStart: "2026-01-01T10:00:00Z", rangeEnd: "2026-01-01T11:00:00Z" });
    expect(res.status).toBe(400);
    expect(resolveStaffAvailability).not.toHaveBeenCalled();
  });

  test("rechaza con fechas inválidas con 400", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    const res = await request(buildApp())
      .post("/api/public/availability")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-1", rangeStart: "no-es-fecha", rangeEnd: "2026-01-01T11:00:00Z" });
    expect(res.status).toBe(400);
  });

  test("rechaza si rangeStart no es anterior a rangeEnd con 400", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    const res = await request(buildApp())
      .post("/api/public/availability")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-1", rangeStart: "2026-01-01T12:00:00Z", rangeEnd: "2026-01-01T11:00:00Z" });
    expect(res.status).toBe(400);
    expect(resolveStaffAvailability).not.toHaveBeenCalled();
  });

  test("404 si el serviceId no existe (ReferencedServiceNotFoundError)", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    resolveStaffAvailability.mockRejectedValue(new ReferencedServiceNotFoundError("svc-no-existe"));

    const res = await request(buildApp())
      .post("/api/public/availability")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-no-existe", rangeStart: "2026-01-01T10:00:00Z", rangeEnd: "2026-01-01T11:00:00Z" });

    expect(res.status).toBe(404);
  });

  test("con parámetros válidos, resuelve tenantId exclusivamente desde la key y responde solo id/name", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    resolveStaffAvailability.mockResolvedValue({
      availableStaff: [
        { id: "staff-1", name: "Ana", tenantId: "tenant-a", phone: "3001234567", email: "ana@x.com", active: true },
      ],
    });

    const res = await request(buildApp())
      .post("/api/public/availability")
      .set("Authorization", "Bearer valida")
      .send({
        serviceId: "svc-1",
        rangeStart: "2026-01-01T10:00:00Z",
        rangeEnd: "2026-01-01T11:00:00Z",
        tenantId: "tenant-falsificado",
      });

    expect(res.status).toBe(200);
    expect(resolveStaffAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: "svc-1", tenantId: "tenant-a" })
    );
    expect(res.body.availableStaff).toEqual([{ id: "staff-1", name: "Ana" }]);
  });
});
