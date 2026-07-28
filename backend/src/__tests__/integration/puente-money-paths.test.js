/**
 * Entregable Puente — criterio M8 (auditoría v2.1.0):
 * toda operación que toca dinero tiene al menos un test del camino real
 * HTTP → caso de uso → persistencia. Prisma se mockea a nivel de cliente;
 * el resto de la cadena (rutas, casos de uso, adaptadores) es la real.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => {
  const client = {
    appointment: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    expense: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    transaction: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    commission: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    dailyClose: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    financialPeriod: { create: jest.fn(), findFirst: jest.fn() },
    settlement: { findFirst: jest.fn() },
    staff: { findFirst: jest.fn(), findMany: jest.fn() },
    user: { findFirst: jest.fn() },
    serviceCategory: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    service: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  client.$transaction = jest.fn(async (fn) => fn(client));
  return client;
});

const prisma = require("../../lib/prisma");
const dashboardRoutes = require("../../routes/dashboard.routes");

const TENANT = "tenant-a";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: TENANT };
    next();
  });
  app.use("/api/dashboard", dashboardRoutes);
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe("POST /expenses — Registrar Gasto por caso de uso", () => {
  test("registra con responsible y sin cierre del día", async () => {
    prisma.dailyClose.findFirst.mockResolvedValue(null);
    prisma.expense.create.mockImplementation(async ({ data }) => ({
      id: "e1", createdAt: new Date(), voidedAt: null, voidReason: null, notes: null, ...data,
    }));

    const res = await request(buildApp())
      .post("/api/dashboard/expenses")
      .send({ description: "Shampoo", amount: 15000, category: "supplies", responsible: "Ana" });

    expect(res.status).toBe(201);
    expect(res.body.responsible).toBe("Ana");
    expect(res.body.status).toBe("active");
    expect(prisma.expense.create).toHaveBeenCalled();
  });

  test("rechaza sin responsible (contrato 2.3)", async () => {
    const res = await request(buildApp())
      .post("/api/dashboard/expenses")
      .send({ description: "Shampoo", amount: 15000 });

    expect(res.status).toBe(400);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  test("rechaza sobre un día con Cierre oficial (409)", async () => {
    prisma.dailyClose.findFirst.mockResolvedValue({ id: "close-1", date: new Date("2026-07-01T00:00:00Z") });

    const res = await request(buildApp())
      .post("/api/dashboard/expenses")
      .send({ description: "Shampoo", amount: 15000, responsible: "Ana", date: "2026-07-01T12:00:00-05:00" });

    expect(res.status).toBe(409);
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });
});

describe("POST /expenses/:id/void — Anular Gasto", () => {
  test("anula con razón, nunca edita", async () => {
    prisma.expense.findUnique.mockResolvedValue({
      id: "e1", tenantId: TENANT, status: "active", date: new Date("2026-07-01T17:00:00Z"),
      category: "supplies", description: "Shampoo", amount: 15000, paymentMethod: "cash",
      notes: null, createdAt: new Date(),
    });
    prisma.dailyClose.findFirst.mockResolvedValue(null);
    prisma.expense.update.mockImplementation(async ({ data }) => ({
      id: "e1", tenantId: TENANT, date: new Date(), category: "supplies", description: "Shampoo",
      amount: 15000, paymentMethod: "cash", notes: null, createdAt: new Date(), responsible: "Ana", ...data,
    }));

    const res = await request(buildApp())
      .post("/api/dashboard/expenses/e1/void")
      .send({ reason: "monto equivocado" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("voided");
    expect(prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "voided", voidReason: "monto equivocado" }) })
    );
  });
});

describe("POST /daily-close — Generar Cierre del Día (ADR 007-D2, 008)", () => {
  test("rechaza el cierre si una cita completada no tiene cobro de sistema (422)", async () => {
    prisma.dailyClose.findFirst.mockResolvedValue(null);
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.expense.findMany.mockResolvedValue([]);
    prisma.commission.findMany.mockResolvedValue([]);
    prisma.appointment.findMany.mockResolvedValue([{ id: "appt-1" }]);

    const res = await request(buildApp()).post("/api/dashboard/daily-close").send({ date: "2026-07-01" });

    expect(res.status).toBe(422);
    expect(res.body.missingAppointmentIds).toEqual(["appt-1"]);
    expect(prisma.dailyClose.create).not.toHaveBeenCalled();
  });

  test("congela el día civil con hechos activos consolidados", async () => {
    prisma.dailyClose.findFirst.mockResolvedValue(null);
    prisma.transaction.findMany.mockResolvedValue([
      { total: 50000, origin: "system_appointment_completed", appointmentId: "appt-1" },
      { total: 20000, origin: "manual_pos_sale", appointmentId: null },
    ]);
    prisma.expense.findMany.mockResolvedValue([{ amount: 10000 }]);
    prisma.commission.findMany.mockResolvedValue([{ staffId: "s1", staffShare: 25000, businessShare: 25000 }]);
    prisma.appointment.findMany.mockResolvedValue([{ id: "appt-1" }]);
    prisma.dailyClose.create.mockImplementation(async ({ data }) => ({ id: "close-1", createdAt: new Date(), ...data }));

    const res = await request(buildApp()).post("/api/dashboard/daily-close").send({ date: "2026-07-01" });

    expect(res.status).toBe(201);
    expect(res.body.incomeTotal).toBe(70000);
    expect(res.body.expenseTotal).toBe(10000);
    expect(res.body.netAmount).toBe(60000);
    // ADR 008-D2: etiqueta canónica = fecha civil T00:00Z
    expect(prisma.dailyClose.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ date: new Date("2026-07-01T00:00:00.000Z") }) })
    );
  });
});

describe("POS — guards y comandos sobre Transaction (ADR 007-D3)", () => {
  test("rechaza venta manual vinculada a cita sin completar (422)", async () => {
    prisma.appointment.findFirst
      .mockResolvedValueOnce({ id: "appt-1" }) // tenant-check de la ruta
      .mockResolvedValueOnce({ id: "appt-1", status: "in_progress" }); // guard del caso de uso

    const res = await request(buildApp())
      .post("/api/dashboard/transactions")
      .send({ appointmentId: "appt-1", items: [{ description: "Snack", unitPrice: 5000 }] });

    expect(res.status).toBe(422);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  test("permite extras vinculados cuando la cita está completada con cobro de sistema", async () => {
    prisma.appointment.findFirst
      .mockResolvedValueOnce({ id: "appt-1" })
      .mockResolvedValueOnce({ id: "appt-1", status: "completed" });
    prisma.transaction.findFirst.mockResolvedValue({ id: "tx-sys", tenantId: TENANT, origin: "system_appointment_completed", status: "active" });
    prisma.transaction.create.mockImplementation(async ({ data }) => ({
      id: "tx-2", createdAt: new Date(), paidAt: new Date(), status: "active", origin: "manual_pos_sale",
      voidedAt: null, voidReason: null, user: null, pet: null, appointment: null, items: [],
      notes: null, ...data, items: [],
    }));

    const res = await request(buildApp())
      .post("/api/dashboard/transactions")
      .send({ appointmentId: "appt-1", items: [{ description: "Snack", unitPrice: 5000 }] });

    expect(res.status).toBe(201);
    expect(prisma.transaction.create).toHaveBeenCalled();
  });

  test("settle actualiza método de pago del cobro de sistema, nunca el monto", async () => {
    prisma.transaction.findFirst
      .mockResolvedValueOnce({ id: "tx-sys", tenantId: TENANT, origin: "system_appointment_completed", appointmentId: "appt-1" })
      .mockResolvedValueOnce({ id: "tx-sys", tenantId: TENANT, origin: "system_appointment_completed", status: "active" });
    let updateArgs;
    prisma.transaction.update.mockImplementation(async (args) => {
      updateArgs = args;
      return { id: "tx-sys" };
    });
    prisma.transaction.findUnique.mockResolvedValue({
      id: "tx-sys", tenantId: TENANT, userId: null, petId: null, appointmentId: "appt-1",
      total: 50000, paymentMethod: "card", notes: null, paidAt: new Date(), createdAt: new Date(),
      origin: "system_appointment_completed", status: "active", voidedAt: null, voidReason: null,
      user: null, pet: null, appointment: null, items: [],
    });

    const res = await request(buildApp())
      .post("/api/dashboard/transactions/tx-sys/settle")
      .send({ paymentMethod: "card" });

    expect(res.status).toBe(200);
    expect(updateArgs.data).toEqual({ paymentMethod: "card" });
    expect(updateArgs.data.total).toBeUndefined();
  });

  test("void solo aplica a ventas manuales y exige razón", async () => {
    prisma.transaction.findUnique.mockResolvedValueOnce({
      id: "tx-sys", tenantId: TENANT, origin: "system_appointment_completed", status: "active", paidAt: new Date(),
    });

    const res = await request(buildApp())
      .post("/api/dashboard/transactions/tx-sys/void")
      .send({ reason: "error" });

    expect(res.status).toBe(422);
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });
});

describe("POST /commissions/:id/void — ADR 009: comando único atómico", () => {
  test("anula y crea el reemplazo en la misma transacción", async () => {
    prisma.commission.findUnique.mockResolvedValue({
      id: "c1", tenantId: TENANT, appointmentId: "appt-1", staffId: "s1", status: "active",
      resolvedPrice: 50000, splitRate: 0.5, staffShare: 25000, businessShare: 25000,
      serviceCategory: "grooming", completedAt: new Date("2026-07-01T17:00:00Z"),
    });
    prisma.dailyClose.findFirst.mockResolvedValue(null);
    prisma.settlement.findFirst.mockResolvedValue(null);
    prisma.commission.update.mockImplementation(async ({ data }) => ({ id: "c1", status: "voided", ...data }));
    prisma.commission.create.mockImplementation(async ({ data }) => ({ id: "c2", ...data }));

    const res = await request(buildApp())
      .post("/api/dashboard/commissions/c1/void")
      .send({ reason: "precio mal resuelto", replacement: { resolvedPrice: 60000 } });

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(res.body.replacement.resolvedPrice).toBe(60000);
    expect(res.body.replacement.staffShare).toBe(30000);
    expect(res.body.replacement.replacesCommissionId).toBe("c1");
  });

  test("rechaza si el día ya tiene Cierre oficial (409, frontera D4a)", async () => {
    prisma.commission.findUnique.mockResolvedValue({
      id: "c1", tenantId: TENANT, appointmentId: "appt-1", staffId: "s1", status: "active",
      splitRate: 0.5, serviceCategory: "grooming", completedAt: new Date("2026-07-01T17:00:00Z"),
    });
    prisma.dailyClose.findFirst.mockResolvedValue({ id: "close-1", date: new Date("2026-07-01T00:00:00Z") });

    const res = await request(buildApp())
      .post("/api/dashboard/commissions/c1/void")
      .send({ reason: "precio mal resuelto" });

    expect(res.status).toBe(409);
    expect(prisma.commission.update).not.toHaveBeenCalled();
  });
});

describe("POST /financial-periods — atomicidad (hallazgo A2)", () => {
  test("crea el período y asigna los cierres dentro de una transacción", async () => {
    prisma.financialPeriod.findFirst.mockResolvedValue(null);
    prisma.dailyClose.findMany.mockResolvedValue([
      { id: "c1", date: new Date("2026-07-01T00:00:00Z"), incomeTotal: 1000, expenseTotal: 100, netAmount: 900 },
      { id: "c2", date: new Date("2026-07-02T00:00:00Z"), incomeTotal: 2000, expenseTotal: 200, netAmount: 1800 },
    ]);
    prisma.financialPeriod.create.mockImplementation(async ({ data }) => ({ id: "p1", createdAt: new Date(), ...data }));
    prisma.dailyClose.updateMany.mockResolvedValue({ count: 2 });

    const res = await request(buildApp())
      .post("/api/dashboard/financial-periods")
      .send({ periodStart: "2026-07-01", periodEnd: "2026-07-02" });

    expect(res.status).toBe(201);
    expect(res.body.incomeTotal).toBe(3000);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  test("el mismatch de asignación revienta dentro de la transacción (409)", async () => {
    prisma.financialPeriod.findFirst.mockResolvedValue(null);
    prisma.dailyClose.findMany.mockResolvedValue([
      { id: "c1", date: new Date("2026-07-01T00:00:00Z"), incomeTotal: 1000, expenseTotal: 100, netAmount: 900 },
    ]);
    prisma.financialPeriod.create.mockImplementation(async ({ data }) => ({ id: "p1", createdAt: new Date(), ...data }));
    prisma.dailyClose.updateMany.mockResolvedValue({ count: 0 }); // otro proceso ya los capturó

    const res = await request(buildApp())
      .post("/api/dashboard/financial-periods")
      .send({ periodStart: "2026-07-01", periodEnd: "2026-07-01" });

    expect(res.status).toBe(409);
  });
});
