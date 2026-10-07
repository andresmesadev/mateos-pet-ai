const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  user: { findFirst: jest.fn() },
  pet: { findFirst: jest.fn() },
  service: { findFirst: jest.fn() },
}));
jest.mock("../../services/appointment.service", () => ({
  createAppointment: jest.fn(),
  buildAppointmentDateTime: jest.fn(),
}));
jest.mock("../../services/availability-db.service", () => ({
  isSlotAvailable: jest.fn(),
  listAvailableSlotsForDate: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { createAppointment, buildAppointmentDateTime } = require("../../services/appointment.service");
const { isSlotAvailable, listAvailableSlotsForDate } = require("../../services/availability-db.service");
const { SlotAlreadyBookedError } = require("../../services/errors/slot-already-booked.error");
const appointmentsRoutes = require("../../routes/dashboard/appointments.routes");

const body = {
  userId: "user-1", petId: "pet-1", serviceId: "svc-1",
  dateKey: "2099-04-15", hour: 11,
};

function appFor(tenantId = "tenant-a") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.tenant = { tenantId }; next(); });
  app.use("/api/dashboard", appointmentsRoutes);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findFirst.mockResolvedValue({ id: "user-1" });
  prisma.pet.findFirst.mockResolvedValue({ id: "pet-1", name: "Luna", type: "dog" });
  prisma.service.findFirst.mockResolvedValue({
    id: "svc-1", active: true, requiresAppointment: true, category: { name: "veterinary" },
  });
  isSlotAvailable.mockResolvedValue(true);
  listAvailableSlotsForDate.mockResolvedValue([11, 11.5]);
  buildAppointmentDateTime.mockReturnValue(new Date("2099-04-15T16:00:00Z"));
  createAppointment.mockResolvedValue({ id: "appt-1", date: new Date("2099-04-15T16:00:00Z"), status: "confirmed" });
});

test("crea una cita manual con referencias validadas en el tenant autenticado", async () => {
  const response = await request(appFor()).post("/api/dashboard/appointments").send({ ...body, tenantId: "tenant-b" });
  expect(response.status).toBe(201);
  expect(prisma.pet.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "pet-1", ownerId: "user-1", tenantId: "tenant-a" },
  }));
  expect(isSlotAvailable).toHaveBeenCalledWith({
    dateKey: body.dateKey, hour: 11, serviceType: "vet", tenantId: "tenant-a",
  });
  expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({
    tenantId: "tenant-a", userId: "user-1", petId: "pet-1", serviceId: "svc-1", serviceType: "vet",
  }));
});

test("rechaza una mascota ajena al cliente o al establecimiento", async () => {
  prisma.pet.findFirst.mockResolvedValue(null);
  const response = await request(appFor()).post("/api/dashboard/appointments").send(body);
  expect(response.status).toBe(404);
  expect(createAppointment).not.toHaveBeenCalled();
});

test("rechaza un horario no disponible", async () => {
  isSlotAvailable.mockResolvedValue(false);
  const response = await request(appFor()).post("/api/dashboard/appointments").send(body);
  expect(response.status).toBe(409);
  expect(createAppointment).not.toHaveBeenCalled();
});

test("maneja la reserva simultánea del mismo horario", async () => {
  createAppointment.mockRejectedValue(new SlotAlreadyBookedError({ tenantId: "tenant-a" }));
  const response = await request(appFor()).post("/api/dashboard/appointments").send(body);
  expect(response.status).toBe(409);
});

test("acepta una consulta veterinaria a y media sin perder los minutos", async () => {
  const response = await request(appFor()).post("/api/dashboard/appointments").send({ ...body, hour: 10.5 });
  expect(response.status).toBe(201);
  expect(isSlotAvailable).toHaveBeenCalledWith({
    dateKey: body.dateKey, hour: 10.5, serviceType: "vet", tenantId: "tenant-a",
  });
  expect(buildAppointmentDateTime).toHaveBeenCalledWith(body.dateKey, 10.5);
});

test("peluquería permite un turno a y media validado por disponibilidad", async () => {
  prisma.service.findFirst.mockResolvedValue({
    id: "svc-1", active: true, requiresAppointment: true, category: { name: "grooming" },
  });
  const response = await request(appFor()).post("/api/dashboard/appointments").send({ ...body, hour: 10.5 });
  expect(response.status).toBe(201);
  expect(isSlotAvailable).toHaveBeenCalledWith({ dateKey: body.dateKey, hour: 10.5, serviceType: "grooming", tenantId: "tenant-a" });
  expect(buildAppointmentDateTime).toHaveBeenCalledWith(body.dateKey, 10.5);
});

test("conserva minutos arbitrarios sin aceptar fracciones de segundo", async () => {
  const hour = 10 + 20 / 60;
  expect((await request(appFor()).post("/api/dashboard/appointments").send({ ...body, hour })).status).toBe(201);
  expect(buildAppointmentDateTime).toHaveBeenCalledWith(body.dateKey, hour);
  expect((await request(appFor()).post("/api/dashboard/appointments").send({ ...body, hour: 10.001 })).status).toBe(400);
});

test("lista solo los horarios del servicio activo en el tenant autenticado", async () => {
  const response = await request(appFor()).get("/api/dashboard/appointments/available-slots")
    .query({ dateKey: body.dateKey, serviceId: "svc-1", tenantId: "tenant-b" });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ slots: [11, 11.5] });
  expect(prisma.service.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "svc-1", tenantId: "tenant-a", active: true },
  }));
  expect(listAvailableSlotsForDate).toHaveBeenCalledWith({
    dateKey: body.dateKey, serviceType: "vet", tenantId: "tenant-a",
  });
});

test("impide consultar horarios de un servicio de otro establecimiento", async () => {
  prisma.service.findFirst.mockResolvedValue(null);
  const response = await request(appFor()).get("/api/dashboard/appointments/available-slots")
    .query({ dateKey: body.dateKey, serviceId: "svc-other" });
  expect(response.status).toBe(404);
  expect(listAvailableSlotsForDate).not.toHaveBeenCalled();
});
