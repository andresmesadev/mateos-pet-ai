const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  appointment: { count: jest.fn(), findMany: jest.fn() },
  user: { count: jest.fn() },
  transaction: { aggregate: jest.fn() },
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

describe("GET /api/dashboard/metrics/daily", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("computes the 5 daily metrics with deltas vs yesterday", async () => {
    // appointment.count → hoy, ayer
    prisma.appointment.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);
    // user.count → clientesHoy, clientesAyer, recordatoriosUsuariosHoy, recordatoriosUsuariosAyer
    prisma.user.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(4);
    // transaction.aggregate → hoy, ayer
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { total: 100000 } })
      .mockResolvedValueOnce({ _sum: { total: 50000 } });
    // appointment.findMany (distinct petId completadas) → hoy, ayer
    prisma.appointment.findMany
      .mockResolvedValueOnce([{ petId: "p1" }, { petId: "p2" }])
      .mockResolvedValueOnce([{ petId: "p1" }]);
    // petNextAction.count (reminderSentAt) → hoy, ayer
    prisma.petNextAction.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);

    const res = await request(app).get("/api/dashboard/metrics/daily");

    expect(res.status).toBe(200);
    expect(res.body.appointmentsToday).toEqual({ count: 5, prev: 3, delta: 2 });
    expect(res.body.newClientsToday).toEqual({ count: 2, prev: 1, delta: 1 });
    expect(res.body.revenueToday).toEqual({ count: 100000, prev: 50000, delta: 50000 });
    expect(res.body.petsAttendedToday).toEqual({ count: 2, prev: 1, delta: 1 });
    // recordatorios = acciones (3) + usuarios (7) hoy; (2) + (4) ayer
    expect(res.body.remindersSentToday).toEqual({ count: 10, prev: 6, delta: 4 });
  });

  it("returns zeros when there is no revenue", async () => {
    prisma.appointment.count.mockResolvedValue(0);
    prisma.user.count.mockResolvedValue(0);
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { total: null } });
    prisma.appointment.findMany.mockResolvedValue([]);
    prisma.petNextAction.count.mockResolvedValue(0);

    const res = await request(app).get("/api/dashboard/metrics/daily");
    expect(res.status).toBe(200);
    expect(res.body.revenueToday).toEqual({ count: 0, prev: 0, delta: 0 });
  });

  it("returns 500 on database error", async () => {
    prisma.appointment.count.mockRejectedValue(new Error("db down"));
    const res = await request(app).get("/api/dashboard/metrics/daily");
    expect(res.status).toBe(500);
  });
});
