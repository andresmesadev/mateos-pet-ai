const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  staffCredential: { findUnique: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const { hashPassword } = require("../../services/staff-credential.service");
const staffAuthRoutes = require("../../routes/staff-auth.routes");
const { allowVeterinaryDashboard } = require("../../middleware/allowVeterinaryDashboard");

const app = express();
app.use(express.json());
app.use("/api/internal", staffAuthRoutes);
app.use("/api/dashboard", (req, _res, next) => {
  req.actor = { type: "vet", staffId: "vet-1" };
  next();
}, allowVeterinaryDashboard, (req, res) => res.json({ allowed: true }));

beforeEach(() => jest.clearAllMocks());

test("individual veterinarian can sign in only while staff, credential and tenant are active", async () => {
  const passwordHash = await hashPassword("Clave-de-veterinaria-123");
  const active = {
    staffId: "vet-1", email: "vet@example.com", passwordHash, active: true, sessionVersion: 2,
    staff: { name: "Dra. Lina", role: "vet", active: true, tenantId: "tenant-a", tenant: { active: true } },
  };
  prisma.staffCredential.findUnique.mockResolvedValue(active);
  const good = await request(app).post("/api/internal/staff-login").send({ email: "VET@EXAMPLE.COM", password: "Clave-de-veterinaria-123" });
  expect(good.status).toBe(200);
  expect(good.body).toMatchObject({ staffId: "vet-1", role: "vet", tenantId: "tenant-a", sessionVersion: 2 });
  expect(good.body).not.toHaveProperty("passwordHash");

  const wrong = await request(app).post("/api/internal/staff-login").send({ email: "vet@example.com", password: "otra-clave" });
  expect(wrong.status).toBe(401);

  prisma.staffCredential.findUnique.mockResolvedValue({ ...active, staff: { ...active.staff, active: false } });
  const disabled = await request(app).post("/api/internal/staff-login").send({ email: "vet@example.com", password: "Clave-de-veterinaria-123" });
  expect(disabled.status).toBe(401);
});

test("clinical account cannot call finances, staff management or change appointment price", async () => {
  expect((await request(app).get("/api/dashboard/transactions")).status).toBe(403);
  expect((await request(app).put("/api/dashboard/staff/vet-1/credential").send({})).status).toBe(403);
  expect((await request(app).patch("/api/dashboard/appointments/a-1").send({ finalPrice: 1000 })).status).toBe(403);
  expect((await request(app).patch("/api/dashboard/appointments/a-1").send({ status: "cancelled" })).status).toBe(403);
  expect((await request(app).get("/api/dashboard/appointments/week")).status).toBe(200);
  expect((await request(app).get("/api/dashboard/pets/p-1/records/r-1/revisions")).status).toBe(200);
  expect((await request(app).patch("/api/dashboard/pets/p-1/records/r-1/revisions").send({ reason: "alterar" })).status).toBe(403);
  expect((await request(app).put("/api/dashboard/appointments/a-1/medical-record").send({ reason: "Control" })).status).toBe(200);
});
