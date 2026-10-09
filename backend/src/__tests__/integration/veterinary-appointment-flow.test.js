const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => {
  const client = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    staff: { findFirst: jest.fn() },
    appointment: { findFirst: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  };
  client.$transaction = jest.fn(async run => run(client));
  return client;
});

const prisma = require("../../lib/prisma");
const appointmentsRoutes = require("../../routes/dashboard/appointments.routes");
const { getBogotaYmd } = require("../../routes/dashboard/shared");

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.tenant = { tenantId: "tenant-a", isSuperAdmin: false };
  req.actor = { type: "vet", staffId: "vet-1" };
  next();
});
app.use("/api/dashboard", appointmentsRoutes);

const appointment = {
  id: "appointment-1", tenantId: "tenant-a", status: "arrived", staffId: null,
  petId: "pet-1", petName: "Luna", petType: "cat", serviceType: "vet", serviceId: null,
  date: new Date(),
  pet: { id: "pet-1", name: "Luna", type: "cat", weight: 4.2 },
  user: { name: "Camila", phone: "3001234567" },
  service: null, staff: null, finalPrice: null,
  startedAt: null, endedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  // A 60-minute fixture must stay within its Colombia day, even when CI runs near midnight.
  appointment.date = new Date(getBogotaYmd() + "T12:00:00-05:00");
  prisma.staff.findFirst.mockResolvedValue({ id: "vet-1", tenantId: "tenant-a", role: "vet", active: true, availability: null, availabilities: [], capabilities: [] });
});

test("starting an unassigned consultation claims it atomically for the authenticated veterinarian", async () => {
  prisma.appointment.findFirst.mockResolvedValueOnce(appointment).mockResolvedValueOnce(appointment);
  prisma.appointment.updateMany.mockResolvedValue({ count: 1 });
  prisma.appointment.findUnique.mockResolvedValue({ ...appointment, status: "in_progress", staffId: "vet-1", staff: { name: "Dra. Lina" } });

  const response = await request(app).patch("/api/dashboard/appointments/appointment-1").send({ status: "in_progress" });

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ status: "in_progress", staffId: "vet-1", finalPrice: null });
  expect(prisma.appointment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "appointment-1", tenantId: "tenant-a", staffId: null, status: "arrived", serviceId: null, date: appointment.date },
    data: expect.objectContaining({ status: "in_progress", staffId: "vet-1" }),
  }));
  expect(prisma.appointment.update).not.toHaveBeenCalled();
});

test("a simultaneous claim does not overwrite the veterinarian who started first", async () => {
  prisma.appointment.findFirst.mockResolvedValueOnce(appointment).mockResolvedValueOnce(appointment);
  prisma.appointment.updateMany.mockResolvedValue({ count: 0 });

  const response = await request(app).patch("/api/dashboard/appointments/appointment-1").send({ status: "in_progress" });

  expect(response.status).toBe(409);
  expect(prisma.appointment.update).not.toHaveBeenCalled();
});

test("a veterinarian cannot advance another professional's appointment", async () => {
  prisma.appointment.findFirst.mockResolvedValueOnce({ ...appointment, staffId: "vet-2" })
    .mockResolvedValueOnce({ ...appointment, staffId: "vet-2" });

  const response = await request(app).patch("/api/dashboard/appointments/appointment-1").send({ status: "in_progress" });

  expect(response.status).toBe(403);
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});

test("an old arrival is not offered as an ordinary new consultation", async () => {
  const old = { ...appointment, date: new Date(Date.now() - 2 * 86_400_000), staffId: "vet-1" };
  prisma.appointment.findFirst.mockResolvedValueOnce(old).mockResolvedValueOnce(old);

  const response = await request(app).patch("/api/dashboard/appointments/appointment-1").send({ status: "in_progress" });

  expect(response.status).toBe(422);
  expect(response.body.error).toMatch(/día anterior/);
  expect(prisma.appointment.update).not.toHaveBeenCalled();
});
