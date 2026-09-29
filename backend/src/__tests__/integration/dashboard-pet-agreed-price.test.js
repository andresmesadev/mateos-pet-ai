const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  appointment: { findFirst: jest.fn(), update: jest.fn() },
}));
jest.mock("../../contexts", () => ({ completeAppointment: jest.fn() }));
jest.mock("../../contexts/services", () => ({ changeServicePrice: jest.fn() }));

const prisma = require("../../lib/prisma");
const { changeServicePrice } = require("../../contexts/services");
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
  prisma.appointment.update.mockImplementation(async ({ data }) => ({ ...BASE, ...data }));
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
  });
  expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { finalPrice: 70000 } }));
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
  expect(prisma.appointment.update).not.toHaveBeenCalled();
});

test.each([-1, "70000", 100000000, 1.999])("rejects invalid agreed price %p", async (price) => {
  const response = await request(app()).patch("/api/dashboard/appointments/appointment-1/agreed-price").send({ price });
  expect(response.status).toBe(400);
  expect(changeServicePrice).not.toHaveBeenCalled();
});
