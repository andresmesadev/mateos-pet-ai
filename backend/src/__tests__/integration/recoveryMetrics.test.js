const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  user: { findMany: jest.fn() },
  appointment: { findMany: jest.fn() },
  petNextAction: { count: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const dashboardRoutes = require("../../routes/dashboard.routes");

const TENANT_ID = "tenant-a";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: TENANT_ID };
    next();
  });
  app.use("/api/dashboard", dashboardRoutes);
  return app;
}

const app = buildApp();

describe("GET /api/dashboard/metrics/recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.petNextAction.count.mockResolvedValue(0);
  });

  it("returns zero rates when nobody was contacted", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/dashboard/metrics/recovery");
    expect(res.status).toBe(200);
    expect(res.body.reactivation).toEqual({ contacted: 0, reactivated: 0, rate: 0 });
  });

  it("does NOT issue a query per user (no N+1) — single appointments.findMany call", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", lastReminderSentAt: new Date("2026-01-01T00:00:00Z") },
      { id: "u2", lastReminderSentAt: new Date("2026-02-01T00:00:00Z") },
      { id: "u3", lastReminderSentAt: new Date("2026-03-01T00:00:00Z") },
    ]);
    prisma.appointment.findMany.mockResolvedValue([]);

    await request(app).get("/api/dashboard/metrics/recovery");

    // Antes era 1 findFirst por usuario (N). Ahora debe ser exactamente 1 findMany.
    expect(prisma.appointment.findMany).toHaveBeenCalledTimes(1);
  });

  it("counts a user as reactivated only if appointment is after THEIR reminder", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", lastReminderSentAt: new Date("2026-01-01T00:00:00Z") },
      { id: "u2", lastReminderSentAt: new Date("2026-03-01T00:00:00Z") },
    ]);
    // u1 tiene cita posterior a su recordatorio (reactivado)
    // u2 tiene cita ANTERIOR a su recordatorio (no cuenta)
    prisma.appointment.findMany.mockResolvedValue([
      { userId: "u1", date: new Date("2026-01-15T00:00:00Z") },
      { userId: "u2", date: new Date("2026-02-01T00:00:00Z") },
    ]);

    const res = await request(app).get("/api/dashboard/metrics/recovery");
    expect(res.status).toBe(200);
    expect(res.body.reactivation.contacted).toBe(2);
    expect(res.body.reactivation.reactivated).toBe(1);
    expect(res.body.reactivation.rate).toBe(50);
  });

  it("does not double-count a user with multiple post-reminder appointments", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", lastReminderSentAt: new Date("2026-01-01T00:00:00Z") },
    ]);
    prisma.appointment.findMany.mockResolvedValue([
      { userId: "u1", date: new Date("2026-01-15T00:00:00Z") },
      { userId: "u1", date: new Date("2026-02-15T00:00:00Z") },
    ]);

    const res = await request(app).get("/api/dashboard/metrics/recovery");
    expect(res.body.reactivation.reactivated).toBe(1);
    expect(res.body.reactivation.rate).toBe(100);
  });

  it("computes nextActions close rate from counts", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.petNextAction.count
      .mockResolvedValueOnce(10) // reminded
      .mockResolvedValueOnce(4); // closed
    const res = await request(app).get("/api/dashboard/metrics/recovery");
    expect(res.body.nextActions).toEqual({ reminded: 10, closed: 4, rate: 40 });
  });

  it("returns 500 on database error", async () => {
    prisma.user.findMany.mockRejectedValue(new Error("db down"));
    const res = await request(app).get("/api/dashboard/metrics/recovery");
    expect(res.status).toBe(500);
  });
});
