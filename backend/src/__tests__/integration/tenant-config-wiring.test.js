/**
 * Entregable 4.3 — Configuración por Establecimiento (Alcance A): verifica
 * que PUT /api/dashboard/tenant/config reutiliza la validación centralizada
 * de business-config.service.js.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  tenant: { findUnique: jest.fn() },
}));

jest.mock("../../services/business-config.service", () => ({
  updateActiveModules: jest.fn(),
  updateCommissionSplitRate: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { updateActiveModules, updateCommissionSplitRate } = require("../../services/business-config.service");
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
  prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, activeModules: ["grooming"], commissionSplitRate: 0.4 });
});

describe("PUT /api/dashboard/tenant/config", () => {
  test("actualiza activeModules cuando se envía", async () => {
    const res = await request(buildApp())
      .put("/api/dashboard/tenant/config")
      .send({ activeModules: ["grooming"] });

    expect(res.status).toBe(200);
    expect(updateActiveModules).toHaveBeenCalledWith(TENANT_ID, ["grooming"]);
    expect(updateCommissionSplitRate).not.toHaveBeenCalled();
  });

  test("actualiza commissionSplitRate cuando se envía", async () => {
    const res = await request(buildApp())
      .put("/api/dashboard/tenant/config")
      .send({ commissionSplitRate: 0.4 });

    expect(res.status).toBe(200);
    expect(updateCommissionSplitRate).toHaveBeenCalledWith(TENANT_ID, 0.4);
    expect(updateActiveModules).not.toHaveBeenCalled();
  });

  test("propaga el error de validación del servicio como 400", async () => {
    updateCommissionSplitRate.mockRejectedValue(new Error("rate must be a number between 0 and 1"));

    const res = await request(buildApp())
      .put("/api/dashboard/tenant/config")
      .send({ commissionSplitRate: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rate must be/);
  });
});
