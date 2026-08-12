/**
 * Revocación de Sesión y Gestión Mínima de ApiKey: verifica
 * GET /api/dashboard/api-keys y POST /api/dashboard/api-keys/:id/revoke —
 * aislamiento por tenant, ausencia de keyHash en la respuesta, ownership
 * obligatorio y revocación idempotente.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  apiKey: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
}));

jest.mock("../../services/business-config.service", () => ({
  updateActiveModules: jest.fn(),
  updateCommissionSplitRate: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const tenantRoutes = require("../../routes/dashboard/tenant.routes");

const TENANT_ID = "tenant-a";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: TENANT_ID };
    next();
  });
  app.use("/api/dashboard", tenantRoutes);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/dashboard/api-keys", () => {
  test("lista las ApiKeys del tenant, sin keyHash", async () => {
    prisma.apiKey.findMany.mockResolvedValue([
      { id: "key-1", scopes: ["read:services"], createdAt: new Date(), revokedAt: null, lastUsedAt: null },
    ]);

    const res = await request(buildApp()).get("/api/dashboard/api-keys");

    expect(res.status).toBe(200);
    expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID },
        select: { id: true, scopes: true, createdAt: true, revokedAt: true, lastUsedAt: true },
      })
    );
    expect(res.body.apiKeys[0]).not.toHaveProperty("keyHash");
  });
});

describe("POST /api/dashboard/api-keys/:id/revoke", () => {
  test("404 si la ApiKey no existe o pertenece a otro tenant", async () => {
    prisma.apiKey.findFirst.mockResolvedValue(null);

    const res = await request(buildApp()).post("/api/dashboard/api-keys/key-ajena/revoke");

    expect(res.status).toBe(404);
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({ where: { id: "key-ajena", tenantId: TENANT_ID } });
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  test("revoca una ApiKey activa, seteando revokedAt", async () => {
    prisma.apiKey.findFirst.mockResolvedValue({ id: "key-1", tenantId: TENANT_ID, revokedAt: null });
    prisma.apiKey.update.mockResolvedValue({
      id: "key-1",
      scopes: [],
      createdAt: new Date(),
      revokedAt: new Date(),
      lastUsedAt: null,
    });

    const res = await request(buildApp()).post("/api/dashboard/api-keys/key-1/revoke");

    expect(res.status).toBe(200);
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { revokedAt: expect.any(Date) },
      select: { id: true, scopes: true, createdAt: true, revokedAt: true, lastUsedAt: true },
    });
    expect(res.body.apiKey).not.toHaveProperty("keyHash");
  });

  test("es idempotente: revocar una ApiKey ya revocada responde 200 sin cambiar la fecha original", async () => {
    const originalRevokedAt = new Date("2026-01-01T00:00:00Z");
    prisma.apiKey.findFirst.mockResolvedValue({ id: "key-1", tenantId: TENANT_ID, revokedAt: originalRevokedAt });
    prisma.apiKey.update.mockResolvedValue({
      id: "key-1",
      scopes: [],
      createdAt: new Date(),
      revokedAt: originalRevokedAt,
      lastUsedAt: null,
    });

    const res = await request(buildApp()).post("/api/dashboard/api-keys/key-1/revoke");

    expect(res.status).toBe(200);
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { revokedAt: originalRevokedAt },
      select: { id: true, scopes: true, createdAt: true, revokedAt: true, lastUsedAt: true },
    });
  });
});
