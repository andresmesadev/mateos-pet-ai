/**
 * Disponibilidad Real de Horarios (Ecosistema): verifica
 * POST /api/public/availability/slots — autenticación, scope, aislamiento
 * cross-tenant, mapeo categoría→bucket, y respuesta "sin disponibilidad"
 * para categorías sin bucket conocido (nunca error, nunca bucket inventado).
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  apiKey: { findUnique: jest.fn(), update: jest.fn() },
}));

jest.mock("../../contexts/services", () => ({
  listAvailableServices: jest.fn(),
  getServiceCategory: jest.fn(),
}));

jest.mock("../../contexts/staff", () => ({
  resolveStaffAvailability: jest.fn(),
}));

jest.mock("../../services/availability-db.service", () => ({
  suggestAvailableVetSlots: jest.fn(),
  findNextAvailableGroomingSlot: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { getServiceCategory } = require("../../contexts/services");
const { ServiceNotFoundError } = require("../../contexts/services/domain/errors");
const { suggestAvailableVetSlots, findNextAvailableGroomingSlot } = require("../../services/availability-db.service");
const { apiKeyAuth } = require("../../middleware/apiKeyAuth");
const publicApiRoutes = require("../../routes/public-api.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/public", apiKeyAuth, publicApiRoutes);
  return app;
}

const KEY_TENANT_A = { id: "key-1", tenantId: "tenant-a", scopes: ["read:availability"], revokedAt: null };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/public/availability/slots", () => {
  test("rechaza sin API key con 401", async () => {
    const res = await request(buildApp()).post("/api/public/availability/slots").send({ serviceId: "svc-1" });
    expect(res.status).toBe(401);
    expect(getServiceCategory).not.toHaveBeenCalled();
  });

  test("rechaza una key sin el scope read:availability con 403", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...KEY_TENANT_A, scopes: [] });
    const res = await request(buildApp())
      .post("/api/public/availability/slots")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-1" });
    expect(res.status).toBe(403);
    expect(getServiceCategory).not.toHaveBeenCalled();
  });

  test("400 sin serviceId", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    const res = await request(buildApp())
      .post("/api/public/availability/slots")
      .set("Authorization", "Bearer valida")
      .send({});
    expect(res.status).toBe(400);
    expect(getServiceCategory).not.toHaveBeenCalled();
  });

  test("resuelve el tenantId exclusivamente desde la ApiKey, nunca desde el body", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    getServiceCategory.mockResolvedValue({ categoryName: "veterinary" });
    suggestAvailableVetSlots.mockResolvedValue({ dateKey: "2026-08-20", hours: [11, 14] });

    await request(buildApp())
      .post("/api/public/availability/slots")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-1", tenantId: "tenant-falsificado" });

    expect(getServiceCategory).toHaveBeenCalledWith({ serviceId: "svc-1", tenantId: "tenant-a" });
    expect(suggestAvailableVetSlots).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-a" })
    );
  });

  test("404 si el serviceId no existe o pertenece a otro tenant", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    getServiceCategory.mockRejectedValue(new ServiceNotFoundError("svc-otro-tenant"));

    const res = await request(buildApp())
      .post("/api/public/availability/slots")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-otro-tenant" });

    expect(res.status).toBe(404);
    expect(suggestAvailableVetSlots).not.toHaveBeenCalled();
    expect(findNextAvailableGroomingSlot).not.toHaveBeenCalled();
  });

  test("categoría veterinary → llama suggestAvailableVetSlots", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    getServiceCategory.mockResolvedValue({ categoryName: "veterinary" });
    suggestAvailableVetSlots.mockResolvedValue({ dateKey: "2026-08-20", hours: [11] });

    const res = await request(buildApp())
      .post("/api/public/availability/slots")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-1", dateKey: "2026-08-20" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true, slots: { dateKey: "2026-08-20", hours: [11] } });
    expect(findNextAvailableGroomingSlot).not.toHaveBeenCalled();
  });

  test("categoría grooming → llama findNextAvailableGroomingSlot", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    getServiceCategory.mockResolvedValue({ categoryName: "grooming" });
    findNextAvailableGroomingSlot.mockResolvedValue({ date: "2026-08-21", hour: 9 });

    const res = await request(buildApp())
      .post("/api/public/availability/slots")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-2" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true, slots: { date: "2026-08-21", hour: 9 } });
    expect(suggestAvailableVetSlots).not.toHaveBeenCalled();
  });

  test("categoría sin bucket conocido responde available:false, sin error y sin inventar bucket", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    getServiceCategory.mockResolvedValue({ categoryName: "other" });

    const res = await request(buildApp())
      .post("/api/public/availability/slots")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-3" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false, slots: null });
    expect(suggestAvailableVetSlots).not.toHaveBeenCalled();
    expect(findNextAvailableGroomingSlot).not.toHaveBeenCalled();
  });

  test("sin ninguna hora libre, available:false con el dateKey resuelto", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    getServiceCategory.mockResolvedValue({ categoryName: "veterinary" });
    suggestAvailableVetSlots.mockResolvedValue({ dateKey: "2026-08-20", hours: [] });

    const res = await request(buildApp())
      .post("/api/public/availability/slots")
      .set("Authorization", "Bearer valida")
      .send({ serviceId: "svc-1" });

    expect(res.body).toEqual({ available: false, slots: { dateKey: "2026-08-20", hours: [] } });
  });
});
