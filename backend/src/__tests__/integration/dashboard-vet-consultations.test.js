const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  appointment: { findMany: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const appointmentsRoutes = require("../../routes/dashboard/appointments.routes");

const app = express();
app.use((req, _res, next) => {
  req.tenant = { tenantId: "tenant-a", isSuperAdmin: false };
  next();
});
app.use("/api/dashboard", appointmentsRoutes);

const row = {
  id: "appt-1",
  date: new Date("2026-09-24T14:00:00.000Z"),
  status: "completed",
  serviceType: "vet",
  petId: "pet-1",
  petName: "Luna",
  petType: "cat",
  user: { name: "Camila", phone: "3001234567" },
  pet: { name: "Luna", type: "cat", defaultGroomingPrice: null },
  service: { name: "Consulta", category: { name: "veterinary" }, basePrice: 66000, priceRules: [] },
  serviceId: "service-1",
  staff: { name: "Dra. Ana" },
  staffId: "staff-1",
  finalPrice: null,
  startedAt: null,
  endedAt: null,
};

test("weekly consultations can be browsed by date and expose clinical record status", async () => {
  prisma.appointment.findMany.mockResolvedValue([
    { ...row, medicalRecord: { id: "record-1" } },
    { ...row, id: "appt-2", medicalRecord: null },
  ]);

  const response = await request(app).get("/api/dashboard/appointments/week?date=2026-09-24");

  expect(response.status).toBe(200);
  expect(response.body.mondayYmd).toBe("2026-09-21");
  expect(response.body.appointments).toEqual([
    expect.objectContaining({ id: "appt-1", hasMedicalRecord: true, staffId: "staff-1", serviceCategory: "veterinary" }),
    expect.objectContaining({ id: "appt-2", hasMedicalRecord: false }),
  ]);
  expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { tenantId: "tenant-a", date: { gte: new Date("2026-09-21T05:00:00.000Z"), lt: new Date("2026-09-28T05:00:00.000Z") } },
    include: expect.objectContaining({ medicalRecord: { select: { id: true } } }),
  }));
});

test("searches veterinary consultations by pet or owner across dates within the tenant", async () => {
  prisma.appointment.findMany.mockResolvedValue([{ ...row, medicalRecord: { id: "record-1" } }]);

  const response = await request(app).get("/api/dashboard/appointments/consultations/search?q=Camila");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    appointments: [expect.objectContaining({ id: "appt-1", hasMedicalRecord: true })],
    hasMore: false,
  });
  const query = prisma.appointment.findMany.mock.calls.at(-1)[0];
  expect(query.where.tenantId).toBe("tenant-a");
  expect(query.where.status).toEqual({ notIn: ["cancelled", "no_show"] });
  expect(query.where.AND[0].OR).toEqual(expect.arrayContaining([
    { service: { is: { category: { is: { name: "veterinary" } } } } },
  ]));
  expect(query.where.AND[1].OR).toEqual([
    { petName: { contains: "Camila", mode: "insensitive" } },
    { pet: { is: { name: { contains: "Camila", mode: "insensitive" } } } },
    { user: { is: { name: { contains: "Camila", mode: "insensitive" } } } },
  ]);
  expect(query).toEqual(expect.objectContaining({ orderBy: { date: "desc" }, take: 51 }));
});

test("limits broad consultation searches and asks for a more specific name", async () => {
  prisma.appointment.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, index) => ({
    ...row,
    id: `appt-${index}`,
    medicalRecord: null,
  })));

  const response = await request(app).get("/api/dashboard/appointments/consultations/search?q=Lu");

  expect(response.status).toBe(200);
  expect(response.body.appointments).toHaveLength(50);
  expect(response.body.hasMore).toBe(true);
});

test("rejects consultation searches shorter than two characters", async () => {
  prisma.appointment.findMany.mockClear();
  const response = await request(app).get("/api/dashboard/appointments/consultations/search?q=L");
  expect(response.status).toBe(400);
  expect(prisma.appointment.findMany).not.toHaveBeenCalled();
});
