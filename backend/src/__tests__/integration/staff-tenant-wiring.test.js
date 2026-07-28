/**
 * Entregable 6.3 (Fase 6) — Staff Multi-Establecimiento: verifica que las
 * tres rutas que antes no transportaban `tenantId` en absoluto
 * (`PUT /staff/:id/availability`, `POST /staff/:id/absences`,
 * `PUT /staff/:id/capabilities`) ahora lo extraen de `req.tenant` y lo
 * propagan al caso de uso correspondiente, cerrando el hueco de
 * autorización cross-tenant detectado en la Macroetapa 1.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../contexts/staff", () => ({
  registerStaff: jest.fn(),
  updateStaff: jest.fn(),
  deactivateStaff: jest.fn(),
  reactivateStaff: jest.fn(),
  updateAvailability: jest.fn(),
  manageStaffCapabilities: jest.fn(),
  recordUnplannedAbsence: jest.fn(),
  generateSettlement: jest.fn(),
  listSettlements: jest.fn(),
  voidCommission: jest.fn(),
}));

const {
  updateAvailability,
  manageStaffCapabilities,
  recordUnplannedAbsence,
} = require("../../contexts/staff");
const staffRoutes = require("../../routes/dashboard/staff.routes");

const TENANT_ID = "tenant-a";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: TENANT_ID };
    next();
  });
  app.use("/api/dashboard", staffRoutes);
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe("Entregable 6.3 — tenantId propagado en rutas antes desprotegidas", () => {
  test("PUT /staff/:id/availability propaga tenantId", async () => {
    updateAvailability.mockResolvedValue({ availability: { id: "a-1" } });

    await request(buildApp())
      .put("/api/dashboard/staff/s-1/availability")
      .send({ type: "base_schedule", schedule: { weekday: 1, startTime: "08:00", endTime: "17:00" } });

    expect(updateAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: "s-1", tenantId: TENANT_ID })
    );
  });

  test("POST /staff/:id/absences propaga tenantId", async () => {
    recordUnplannedAbsence.mockResolvedValue({ availability: { id: "a-2" } });

    await request(buildApp())
      .post("/api/dashboard/staff/s-1/absences")
      .send({ startAt: "2026-07-10T08:00:00Z", endAt: "2026-07-10T12:00:00Z" });

    expect(recordUnplannedAbsence).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: "s-1", tenantId: TENANT_ID })
    );
  });

  test("PUT /staff/:id/capabilities propaga tenantId", async () => {
    manageStaffCapabilities.mockResolvedValue({ capabilities: [], added: [], removed: [] });

    await request(buildApp())
      .put("/api/dashboard/staff/s-1/capabilities")
      .send({ serviceIds: ["svc-1"] });

    expect(manageStaffCapabilities).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: "s-1", tenantId: TENANT_ID })
    );
  });
});
