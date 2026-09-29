/**
 * Corrección del bypass de aislamiento en resolve-service-price/
 * change-service-price (B3): verifica que PATCH /api/dashboard/services/:id
 * propaga el tenantId ya resuelto por la ruta hacia changeServicePrice,
 * como segunda capa de defensa además del ownership check que la ruta ya
 * hacía antes de este entregable.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  service: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  serviceCategory: { findFirst: jest.fn(), findUnique: jest.fn() },
}));

jest.mock("../../contexts/services", () => ({
  createService: jest.fn(),
  updateService: jest.fn(),
  deactivateService: jest.fn(),
  changeServicePrice: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { changeServicePrice, updateService, deactivateService } = require("../../contexts/services");
const servicesRoutes = require("../../routes/dashboard/services.routes");

const TENANT_ID = "tenant-a";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: TENANT_ID };
    next();
  });
  app.use("/api/dashboard", servicesRoutes);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.service.findFirst.mockResolvedValue({ id: "service-1" });
  prisma.service.findUnique.mockResolvedValue({ id: "service-1", basePrice: 40000, categoryId: null });
  prisma.serviceCategory.findUnique.mockResolvedValue(null);
  changeServicePrice.mockResolvedValue({ service: { id: "service-1" }, appliedRule: null });
});

describe("PATCH /api/dashboard/services/:id — propagación de tenantId a changeServicePrice", () => {
  test("propaga el tenantId ya resuelto por la ruta", async () => {
    const res = await request(buildApp()).patch("/api/dashboard/services/service-1").send({ basePrice: 40000 });

    expect(res.status).toBe(200);
    expect(changeServicePrice).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: "service-1", tenantId: TENANT_ID, target: { type: "base" } })
    );
  });

  test("guarda nombre y precio base con el contrato correcto", async () => {
    const res = await request(buildApp()).patch("/api/dashboard/services/service-1")
      .send({ name: "Consulta general", duration: 45, basePrice: 66000 });

    expect(res.status).toBe(200);
    expect(updateService).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT_ID, serviceId: "service-1", name: "Consulta general", duration: 45,
    }));
    expect(changeServicePrice).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT_ID, serviceId: "service-1", target: { type: "base" }, newPrice: 66000,
    }));
  });

  test("rechaza un precio inválido antes de actualizar el nombre", async () => {
    const res = await request(buildApp()).patch("/api/dashboard/services/service-1")
      .send({ name: "Nombre nuevo", basePrice: -1 });

    expect(res.status).toBe(400);
    expect(updateService).not.toHaveBeenCalled();
    expect(changeServicePrice).not.toHaveBeenCalled();
  });
});

test("DELETE retira el servicio usando el caso de uso de desactivación", async () => {
  const res = await request(buildApp()).delete("/api/dashboard/services/service-1");
  expect(res.status).toBe(204);
  expect(deactivateService).toHaveBeenCalledWith({ serviceId: "service-1" });
  expect(prisma.service.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "service-1", tenantId: TENANT_ID },
  }));
});
