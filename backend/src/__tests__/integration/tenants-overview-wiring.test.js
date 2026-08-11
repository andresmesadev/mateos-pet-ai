/**
 * Entregable 6.6 (Fase 6) — Operación Centralizada, Fase A: verifica que
 * GET /api/dashboard/tenants/overview está gateado exclusivamente por
 * req.tenant.viewAllTenants, nunca expone registros individuales y agrega
 * correctamente desde Transaction/Expense (nunca DailyClose ni Commission).
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  tenant: { findMany: jest.fn() },
  user: { groupBy: jest.fn() },
  appointment: { groupBy: jest.fn() },
  conversation: { groupBy: jest.fn() },
  transaction: { groupBy: jest.fn() },
  expense: { groupBy: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const tenantRoutes = require("../../routes/dashboard/tenant.routes");

function buildApp(tenantOverrides) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: null, viewAllTenants: false, ...tenantOverrides };
    next();
  });
  app.use("/api/dashboard", tenantRoutes);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/dashboard/tenants/overview — autorización", () => {
  test("usuario normal (sin viewAllTenants) recibe 403", async () => {
    const res = await request(buildApp({})).get("/api/dashboard/tenants/overview");
    expect(res.status).toBe(403);
    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
  });

  test("superadmin impersonando (con tenantId) recibe 403", async () => {
    const res = await request(
      buildApp({ isSuperAdmin: true, tenantId: "tenant-a", viewAllTenants: false })
    ).get("/api/dashboard/tenants/overview");
    expect(res.status).toBe(403);
    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
  });

  test("superadmin con viewAllTenants recibe 200", async () => {
    prisma.tenant.findMany.mockResolvedValue([]);
    prisma.user.groupBy.mockResolvedValue([]);
    prisma.appointment.groupBy.mockResolvedValue([]);
    prisma.conversation.groupBy.mockResolvedValue([]);
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.expense.groupBy.mockResolvedValue([]);

    const res = await request(
      buildApp({ isSuperAdmin: true, tenantId: null, viewAllTenants: true })
    ).get("/api/dashboard/tenants/overview");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/dashboard/tenants/overview — aislamiento y agregación", () => {
  const app = () => buildApp({ isSuperAdmin: true, tenantId: null, viewAllTenants: true });

  test("agrega correctamente por tenant y nunca expone campos de registro individual", async () => {
    prisma.tenant.findMany.mockResolvedValue([
      { id: "tenant-a", name: "Clínica A", plan: "pro", active: true },
      { id: "tenant-b", name: "Clínica B", plan: "free", active: true },
    ]);
    prisma.user.groupBy.mockResolvedValue([
      { tenantId: "tenant-a", _count: { _all: 5 } },
    ]);
    prisma.appointment.groupBy.mockResolvedValue([
      { tenantId: "tenant-a", _count: { _all: 3 } },
      { tenantId: "tenant-b", _count: { _all: 1 } },
    ]);
    prisma.conversation.groupBy.mockResolvedValue([
      { tenantId: "tenant-b", _count: { _all: 2 } },
    ]);
    prisma.transaction.groupBy.mockResolvedValue([
      { tenantId: "tenant-a", _sum: { total: 100000 } },
    ]);
    prisma.expense.groupBy.mockResolvedValue([
      { tenantId: "tenant-a", _sum: { amount: 30000 } },
    ]);

    const res = await request(app()).get("/api/dashboard/tenants/overview");

    expect(res.status).toBe(200);
    expect(res.body.tenants).toHaveLength(2);

    const a = res.body.tenants.find((t) => t.tenantId === "tenant-a");
    expect(a).toEqual({
      tenantId: "tenant-a",
      name: "Clínica A",
      plan: "pro",
      active: true,
      usersCount: 5,
      appointmentsCount: 3,
      conversationsCount: 0,
      revenueTotal: 100000,
      expenseTotal: 30000,
      netTotal: 70000,
    });

    const b = res.body.tenants.find((t) => t.tenantId === "tenant-b");
    expect(b.usersCount).toBe(0);
    expect(b.appointmentsCount).toBe(1);
    expect(b.conversationsCount).toBe(2);
    expect(b.revenueTotal).toBe(0);
    expect(b.netTotal).toBe(0);

    // Ningún campo de registro individual (userId, phone, appointmentId, etc.)
    for (const row of res.body.tenants) {
      expect(Object.keys(row).sort()).toEqual(
        [
          "active",
          "appointmentsCount",
          "conversationsCount",
          "expenseTotal",
          "name",
          "netTotal",
          "plan",
          "revenueTotal",
          "tenantId",
          "usersCount",
        ].sort()
      );
    }
  });

  test("un tenant activo sin ninguna actividad aparece con ceros, no ausente", async () => {
    prisma.tenant.findMany.mockResolvedValue([
      { id: "tenant-silencioso", name: "Clínica silenciosa", plan: "free", active: true },
    ]);
    prisma.user.groupBy.mockResolvedValue([]);
    prisma.appointment.groupBy.mockResolvedValue([]);
    prisma.conversation.groupBy.mockResolvedValue([]);
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.expense.groupBy.mockResolvedValue([]);

    const res = await request(app()).get("/api/dashboard/tenants/overview");

    expect(res.status).toBe(200);
    expect(res.body.tenants).toEqual([
      {
        tenantId: "tenant-silencioso",
        name: "Clínica silenciosa",
        plan: "free",
        active: true,
        usersCount: 0,
        appointmentsCount: 0,
        conversationsCount: 0,
        revenueTotal: 0,
        expenseTotal: 0,
        netTotal: 0,
      },
    ]);
  });

  test("solo consulta tenants activos", async () => {
    prisma.tenant.findMany.mockResolvedValue([]);
    prisma.user.groupBy.mockResolvedValue([]);
    prisma.appointment.groupBy.mockResolvedValue([]);
    prisma.conversation.groupBy.mockResolvedValue([]);
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.expense.groupBy.mockResolvedValue([]);

    await request(app()).get("/api/dashboard/tenants/overview");

    expect(prisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    );
  });

  test("filtra transacciones anuladas (status distinto de active) vía el where del groupBy", async () => {
    prisma.tenant.findMany.mockResolvedValue([{ id: "tenant-a", name: "A", plan: "free", active: true }]);
    prisma.user.groupBy.mockResolvedValue([]);
    prisma.appointment.groupBy.mockResolvedValue([]);
    prisma.conversation.groupBy.mockResolvedValue([]);
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.expense.groupBy.mockResolvedValue([]);

    await request(app()).get("/api/dashboard/tenants/overview");

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "active" }),
      })
    );
  });
});
