const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  pet: { findFirst: jest.fn() },
  service: { findFirst: jest.fn() },
  priceRule: { findMany: jest.fn() },
}));
jest.mock("../../contexts/services", () => ({ changeServicePrice: jest.fn() }));

const prisma = require("../../lib/prisma");
const { changeServicePrice } = require("../../contexts/services");
const petsRoutes = require("../../routes/dashboard/pets.routes");

function app() {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => { req.tenant = { tenantId: "tenant-a" }; next(); });
  server.use("/api/dashboard", petsRoutes);
  return server;
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.pet.findFirst.mockResolvedValue({ id: "pet-luna", tenantId: "tenant-a" });
  prisma.service.findFirst.mockResolvedValue({ id: "bath-basic" });
  prisma.priceRule.findMany.mockResolvedValue([
    { price: 70000, service: { id: "bath-basic", name: "Baño básico", active: true } },
    { price: 90000, service: { id: "retired", name: "Servicio retirado", active: false } },
  ]);
  changeServicePrice.mockResolvedValue({});
});

test("lists only active service tariffs for a pet in the selected tenant", async () => {
  const response = await request(app()).get("/api/dashboard/pets/pet-luna/prices");
  expect(response.status).toBe(200);
  expect(prisma.pet.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "pet-luna", tenantId: "tenant-a" } }));
  expect(prisma.priceRule.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ targetType: "pet", targetId: "pet-luna", service: { tenantId: "tenant-a" } }),
  }));
  expect(response.body).toEqual([{ serviceId: "bath-basic", serviceName: "Baño básico", price: 70000 }]);
});

test("updates a future tariff through the Services use case", async () => {
  const response = await request(app()).patch("/api/dashboard/pets/pet-luna/prices/bath-basic").send({ price: 80000 });
  expect(response.status).toBe(200);
  expect(changeServicePrice).toHaveBeenCalledWith({
    serviceId: "bath-basic", tenantId: "tenant-a", target: { type: "pet", petId: "pet-luna" }, newPrice: 80000,
  });
  expect(prisma.service.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "bath-basic", tenantId: "tenant-a", active: true },
  }));
});

test("rejects a service from a different establishment", async () => {
  prisma.service.findFirst.mockResolvedValue(null);
  const response = await request(app()).patch("/api/dashboard/pets/pet-luna/prices/foreign-service").send({ price: 80000 });
  expect(response.status).toBe(404);
  expect(changeServicePrice).not.toHaveBeenCalled();
});

test("rejects a pet outside the tenant before reading or changing tariffs", async () => {
  prisma.pet.findFirst.mockResolvedValue(null);
  const list = await request(app()).get("/api/dashboard/pets/pet-luna/prices");
  const update = await request(app()).patch("/api/dashboard/pets/pet-luna/prices/bath-basic").send({ price: 80000 });
  expect(list.status).toBe(404);
  expect(update.status).toBe(404);
  expect(prisma.priceRule.findMany).not.toHaveBeenCalled();
  expect(changeServicePrice).not.toHaveBeenCalled();
});
