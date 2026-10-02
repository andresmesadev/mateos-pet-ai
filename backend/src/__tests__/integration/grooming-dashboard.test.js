const express = require("express");
const request = require("supertest");
jest.mock("../../lib/prisma", () => ({
  tenant: { findUnique: jest.fn() },
  pet: { findFirst: jest.fn() },
  appointment: { findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
}));
const prisma = require("../../lib/prisma");
const routes = require("../../routes/dashboard/grooming.routes");
const { allowVeterinaryDashboard } = require("../../middleware/allowVeterinaryDashboard");
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.tenant = { tenantId: "tenant-a" }; req.actor = { type: req.get("x-test-role") ?? "admin" }; next(); });
app.use("/api/dashboard", allowVeterinaryDashboard, routes);
const visit = { id: "a-1", tenantId: "tenant-a", petId: "p-1", date: new Date(), status: "in_progress", serviceType: "grooming", petName: "Toby", groomingNotes: "Anterior", groomingNotesVersion: 2 };
beforeEach(() => {
  jest.resetAllMocks();
  prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["grooming"] });
  prisma.appointment.findFirst.mockResolvedValue(visit);
  prisma.appointment.findMany.mockResolvedValue([]);
});
test("grooming module is required and restricted vets cannot access it", async () => {
  expect((await request(app).get("/api/dashboard/grooming/appointments").set("x-test-role", "vet")).status).toBe(403);
  expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: "tenant-a" }, select: { activeModules: true } });
  prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["veterinary"] });
  expect((await request(app).get("/api/dashboard/grooming/appointments")).status).toBe(200);
  expect((await request(app).put("/api/dashboard/grooming/appointments/a-1/notes").send({ notes: "Cambio", expectedVersion: 2 })).status).toBe(403);
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});
test("list combines tenant, category and civil day while searching across dates", async () => {
  expect((await request(app).get("/api/dashboard/grooming/appointments?date=2026-09-30")).status).toBe(200);
  const where = prisma.appointment.findMany.mock.calls[0][0].where;
  expect(where.tenantId).toBe("tenant-a");
  expect(where.AND[1].date.gte.toISOString()).toBe("2026-09-30T05:00:00.000Z");
  expect(where.AND[0].OR[0]).toEqual({ service: { is: { category: { is: { name: "grooming" } } } } });
  await request(app).get("/api/dashboard/grooming/appointments?search=Toby");
  expect(prisma.appointment.findMany.mock.calls[1][0].where.AND[1].OR).toEqual(expect.arrayContaining([{ petName: { contains: "Toby", mode: "insensitive" } }]));
});
test("invalid dates and oversized notes are rejected", async () => {
  expect((await request(app).get("/api/dashboard/grooming/appointments?date=2026-02-30")).status).toBe(400);
  expect((await request(app).put("/api/dashboard/grooming/appointments/a-1/notes").send({ notes: "x".repeat(6001), expectedVersion: 2 })).status).toBe(400);
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});
test("note save cannot edit another tenant or a veterinary appointment", async () => {
  prisma.appointment.findFirst.mockResolvedValue(null);
  expect((await request(app).put("/api/dashboard/grooming/appointments/other/notes").send({ notes: "Nuevo", expectedVersion: 2 })).status).toBe(404);
  expect(prisma.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "other", tenantId: "tenant-a", AND: expect.any(Array) }) }));
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});
test("version conflicts preserve the current note including a simultaneous update", async () => {
  const body = { notes: "Nueva nota", expectedVersion: 1 };
  expect((await request(app).put("/api/dashboard/grooming/appointments/a-1/notes").send(body)).status).toBe(409);
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
  prisma.appointment.updateMany.mockResolvedValue({ count: 0 });
  expect((await request(app).put("/api/dashboard/grooming/appointments/a-1/notes").send({ ...body, expectedVersion: 2 })).status).toBe(409);
});
test("saved notes belong to the visit, unchanged text has no new version", async () => {
  expect((await request(app).put("/api/dashboard/grooming/appointments/a-1/notes").send({ notes: "Anterior", expectedVersion: 2 })).status).toBe(200);
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
  prisma.appointment.updateMany.mockResolvedValue({ count: 1 });
  prisma.appointment.findFirst.mockResolvedValueOnce(visit).mockResolvedValueOnce({ ...visit, groomingNotes: "Corte corto", groomingNotesVersion: 3 });
  const result = await request(app).put("/api/dashboard/grooming/appointments/a-1/notes").send({ notes: " Corte corto ", expectedVersion: 2 });
  expect(result.body).toMatchObject({ groomingNotes: "Corte corto", groomingNotesVersion: 3 });
  expect(prisma.appointment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-a", groomingNotesVersion: 2 }), data: expect.objectContaining({ groomingNotes: "Corte corto", groomingNotesVersion: { increment: 1 } }) }));
});
test.each(["cancelled", "no_show"])("%s visit cannot receive new notes", async (status) => {
  prisma.appointment.findFirst.mockResolvedValue({ ...visit, status });
  expect((await request(app).put("/api/dashboard/grooming/appointments/a-1/notes").send({ notes: "Nueva", expectedVersion: 2 })).status).toBe(422);
});
test("delivery is only possible after completion and is idempotent", async () => {
  expect((await request(app).post("/api/dashboard/grooming/appointments/a-1/delivery")).status).toBe(422);
  const delivered = { ...visit, status: "completed", groomingDeliveredAt: new Date("2026-09-30T15:00:00Z") };
  prisma.appointment.findFirst.mockResolvedValueOnce({ ...visit, status: "completed" }).mockResolvedValueOnce(delivered);
  prisma.appointment.updateMany.mockResolvedValue({ count: 1 });
  expect((await request(app).post("/api/dashboard/grooming/appointments/a-1/delivery")).body.groomingDeliveredAt).toBe("2026-09-30T15:00:00.000Z");
  expect(prisma.appointment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "completed", groomingDeliveredAt: null }), data: { groomingDeliveredAt: expect.any(Date) } }));
  prisma.appointment.updateMany.mockClear();
  prisma.appointment.findFirst.mockResolvedValue(delivered);
  expect((await request(app).post("/api/dashboard/grooming/appointments/a-1/delivery")).status).toBe(200);
  expect(prisma.appointment.updateMany).not.toHaveBeenCalled();
});
test("pet history and cursors must belong to the tenant and same pet", async () => {
  prisma.pet.findFirst.mockResolvedValue(null);
  expect((await request(app).get("/api/dashboard/grooming/pets/p-other/notes")).status).toBe(404);
  expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  prisma.pet.findFirst.mockResolvedValue({ id: "p-1" });
  prisma.appointment.findFirst.mockResolvedValue(null);
  expect((await request(app).get("/api/dashboard/grooming/pets/p-1/notes?cursor=foreign")).status).toBe(404);
  expect(prisma.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-a", petId: "p-1", id: "foreign" }) }));
});
test("history pagination carries a scoped stable cursor", async () => {
  prisma.pet.findFirst.mockResolvedValue({ id: "p-1" });
  prisma.appointment.findMany.mockResolvedValue(Array.from({ length: 21 }, (_, i) => ({ ...visit, id: `a-${i}` })));
  const result = await request(app).get("/api/dashboard/grooming/pets/p-1/notes?exclude=current");
  expect(result.body.visits).toHaveLength(20);
  expect(result.body.nextCursor).toBe("a-19");
  expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ petId: "p-1", tenantId: "tenant-a", AND: expect.arrayContaining([{ id: { not: "current" } }]) }) }));
});
