const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  appointment: { findFirst: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  pet: { updateMany: jest.fn() }, $queryRaw: jest.fn(), $transaction: jest.fn(),
  priceRule: { findFirst: jest.fn() },
}));
jest.mock("../../contexts", () => ({ completeAppointment: jest.fn() }));
jest.mock("../../contexts/services", () => ({ changePetServicePriceInTransaction: jest.fn() }));

const prisma = require("../../lib/prisma");
const { changePetServicePriceInTransaction: changeServicePrice } = require("../../contexts/services");
const appointmentsRoutes = require("../../routes/dashboard/appointments.routes");

const BASE = {
  id: "appointment-1",
  tenantId: "tenant-a",
  petId: "pet-luna",
  serviceId: "bath-basic",
  status: "confirmed",
  finalPrice: null,
  petName: "Luna",
  petType: "dog",
  serviceType: "grooming",
  date: new Date("2026-09-28T15:00:00Z"),
  pet: { name: "Luna", type: "dog", defaultGroomingPrice: null },
  service: { name: "Baño básico", basePrice: null, priceRules: [{ targetId: "pet-luna", price: 70000 }] },
  user: { phone: "3000000000", name: "Ana" },
};

function app() {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => { req.tenant = { tenantId: "tenant-a", isSuperAdmin: false }; next(); });
  server.use("/api/dashboard", appointmentsRoutes);
  return server;
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.appointment.findFirst.mockResolvedValue(BASE);
  prisma.appointment.updateMany.mockResolvedValue({ count: 1 });
  prisma.appointment.findUnique.mockResolvedValue({ ...BASE, finalPrice: 70000 });
  prisma.appointment.update.mockResolvedValue({ ...BASE, finalPrice: 70000 });
  prisma.pet.updateMany.mockResolvedValue({ count: 1 });
  prisma.$transaction.mockImplementation(fn => fn(prisma));
  changeServicePrice.mockResolvedValue({});
});

test("saves the price for this appointment and this pet/service through Services", async () => {
  const response = await request(app()).patch("/api/dashboard/appointments/appointment-1/agreed-price").send({ price: 70000 });

  expect(response.status).toBe(200);
  expect(changeServicePrice).toHaveBeenCalledWith({
    serviceId: "bath-basic",
    tenantId: "tenant-a",
    target: { type: "pet", petId: "pet-luna" },
    newPrice: 70000,
  }, { tx: prisma, afterCommit: expect.any(Array) });
  expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: BASE.id }, data: { finalPrice: 70000, priceActorId: null, priceActorName: null, priceActorRole: null } }));
  expect(prisma.pet.updateMany).toHaveBeenCalledWith({ where: { id: BASE.petId, tenantId: BASE.tenantId }, data: { defaultGroomingPrice: 70000 } });
  expect(response.body.finalPrice).toBe(70000);
});

test("does not write across tenants or for completed appointments", async () => {
  prisma.appointment.findFirst.mockResolvedValueOnce(null);
  const foreign = await request(app()).patch("/api/dashboard/appointments/appointment-1/agreed-price").send({ price: 70000 });
  expect(foreign.status).toBe(404);

  prisma.appointment.findFirst.mockResolvedValueOnce({ ...BASE, status: "completed" });
  const completed = await request(app()).patch("/api/dashboard/appointments/appointment-1/agreed-price").send({ price: 70000 });
  expect(completed.status).toBe(422);
  expect(changeServicePrice).not.toHaveBeenCalled();
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});

test("does not rewrite the grooming/transport breakdown through the legacy agreed-price endpoint", async () => {
  prisma.appointment.findFirst.mockResolvedValueOnce({ ...BASE, transportMode: "round_trip", transportPrice: 8000 });
  const response = await request(app()).patch("/api/dashboard/appointments/appointment-1/agreed-price").send({ price: 103000 });
  expect(response.status).toBe(422);
  expect(changeServicePrice).not.toHaveBeenCalled();
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});

test("a concurrent closure or transport change cannot overwrite the appointment charge", async () => {
  prisma.appointment.findFirst.mockResolvedValueOnce(BASE).mockResolvedValueOnce({ ...BASE, status: 'completed' });
  const response = await request(app()).patch("/api/dashboard/appointments/appointment-1/agreed-price").send({ price: 70000 });
  expect(response.status).toBe(409);
  expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
  expect(changeServicePrice).not.toHaveBeenCalled();
});

test.each([-1, "70000", 100000000, 1.999])("rejects invalid agreed price %p", async (price) => {
  const response = await request(app()).patch("/api/dashboard/appointments/appointment-1/agreed-price").send({ price });
  expect(response.status).toBe(400);
  expect(changeServicePrice).not.toHaveBeenCalled();
});
