const express = require("express");
const request = require("supertest");

// Mock prisma before requiring routes
jest.mock("../../lib/prisma", () => ({
  appointment: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  staff: {
    findFirst: jest.fn(),
  },
  service: {
    findFirst: jest.fn(),
  },
}));

const prisma = require("../../lib/prisma");
const dashboardRoutes = require("../../routes/dashboard.routes");

function buildApp(tenant) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = tenant;
    next();
  });
  app.use("/api/dashboard", dashboardRoutes);
  return app;
}

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const BASE_APPT = {
  id: "appt-1",
  tenantId: TENANT_A,
  status: "pending",
  petName: "Luna",
  petType: "dog",
  serviceType: "vet",
  date: new Date("2026-06-17T14:00:00Z"),
  finalPrice: null,
  startedAt: null,
  endedAt: null,
  user: { phone: "573001111111", name: "Carlos" },
  pet: { name: "Luna", type: "dog" },
  service: null,
  staff: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: update echoes the input
  prisma.appointment.update.mockImplementation(async ({ data }) => ({
    ...BASE_APPT,
    ...data,
  }));
});

describe("PATCH /api/dashboard/appointments/:id — ownership", () => {
  test("returns 404 when appointment belongs to a different tenant", async () => {
    prisma.appointment.findFirst.mockResolvedValue(null); // not found for tenant B

    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_B });
    const res = await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ status: "confirmed" });

    expect(res.status).toBe(404);
  });

  test("returns 200 when appointment belongs to the requesting tenant", async () => {
    prisma.appointment.findFirst.mockResolvedValue({ ...BASE_APPT });

    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
    const res = await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ status: "confirmed" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
  });

  test("super admin (null tenantId) can update any appointment", async () => {
    prisma.appointment.findFirst.mockResolvedValue({ ...BASE_APPT });

    const app = buildApp({ isSuperAdmin: true, tenantId: null });
    const res = await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ status: "confirmed" });

    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/dashboard/appointments/:id — status transitions", () => {
  function appWithAppt(currentStatus) {
    prisma.appointment.findFirst.mockResolvedValue({
      ...BASE_APPT,
      status: currentStatus,
    });
    prisma.appointment.update.mockImplementation(async ({ data }) => ({
      ...BASE_APPT,
      status: currentStatus,
      ...data,
    }));
    return buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
  }

  test.each([
    ["pending", "confirmed"],
    ["pending", "cancelled"],
    ["confirmed", "arrived"],
    ["confirmed", "cancelled"],
    ["arrived", "in_progress"],
    ["arrived", "no_show"],
    ["in_progress", "completed"],
  ])("allows %s → %s", async (from, to) => {
    const res = await request(appWithAppt(from))
      .patch("/api/dashboard/appointments/appt-1")
      .send({ status: to });

    expect(res.status).toBe(200);
  });

  test.each([
    ["confirmed", "pending"],
    ["arrived", "confirmed"],
    ["in_progress", "arrived"],
    ["completed", "in_progress"],
    ["cancelled", "pending"],
    ["no_show", "confirmed"],
    ["pending", "completed"],
    ["confirmed", "in_progress"],
  ])("rejects %s → %s with 422", async (from, to) => {
    const res = await request(appWithAppt(from))
      .patch("/api/dashboard/appointments/appt-1")
      .send({ status: to });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Transición no permitida/);
  });

  test("rejects unknown status with 400", async () => {
    prisma.appointment.findFirst.mockResolvedValue({ ...BASE_APPT });
    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
    const res = await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ status: "done" });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/dashboard/appointments/:id — auto timestamps", () => {
  test("sets startedAt when transitioning to in_progress", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      ...BASE_APPT,
      status: "arrived",
    });
    let capturedData;
    prisma.appointment.update.mockImplementation(async ({ data }) => {
      capturedData = data;
      return { ...BASE_APPT, status: "in_progress", ...data };
    });

    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
    const res = await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ status: "in_progress" });

    expect(res.status).toBe(200);
    expect(capturedData.startedAt).toBeInstanceOf(Date);
    expect(capturedData.endedAt).toBeUndefined();
  });

  test("sets endedAt when transitioning to completed", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      ...BASE_APPT,
      status: "in_progress",
    });
    let capturedData;
    prisma.appointment.update.mockImplementation(async ({ data }) => {
      capturedData = data;
      return { ...BASE_APPT, status: "completed", ...data };
    });

    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
    const res = await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ status: "completed" });

    expect(res.status).toBe(200);
    expect(capturedData.endedAt).toBeInstanceOf(Date);
  });
});

describe("PATCH /api/dashboard/appointments/:id — staff/service tenant isolation", () => {
  beforeEach(() => {
    prisma.appointment.findFirst.mockResolvedValue({ ...BASE_APPT });
  });

  test("rejects staffId from different tenant (findFirst returns null)", async () => {
    prisma.staff.findFirst.mockResolvedValue(null);

    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
    const res = await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ staffId: "staff-other-tenant" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Profesional/);
  });

  test("accepts staffId that belongs to same tenant", async () => {
    prisma.staff.findFirst.mockResolvedValue({ id: "staff-1", tenantId: TENANT_A, name: "Dr. Mesa" });

    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
    const res = await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ staffId: "staff-1" });

    expect(res.status).toBe(200);
  });

  test("rejects serviceId from different tenant", async () => {
    prisma.service.findFirst.mockResolvedValue(null);

    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
    const res = await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ serviceId: "svc-other" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Servicio/);
  });

  test("accepts serviceId that belongs to same tenant", async () => {
    prisma.service.findFirst.mockResolvedValue({
      id: "svc-1",
      tenantId: TENANT_A,
      name: "Consulta general",
      basePrice: null,
    });

    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
    const res = await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ serviceId: "svc-1" });

    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/dashboard/appointments/:id — finalPrice as historical record", () => {
  test("explicit finalPrice is stored even when service has no basePrice", async () => {
    prisma.appointment.findFirst.mockResolvedValue({ ...BASE_APPT });
    let capturedData;
    prisma.appointment.update.mockImplementation(async ({ data }) => {
      capturedData = data;
      return { ...BASE_APPT, ...data };
    });

    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
    await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ finalPrice: 85000 });

    expect(capturedData.finalPrice).toBe(85000);
  });

  test("finalPrice is not overwritten when assigning a service (already set on appointment)", async () => {
    prisma.appointment.findFirst.mockResolvedValue({ ...BASE_APPT, finalPrice: 75000 });
    prisma.service.findFirst.mockResolvedValue({
      id: "svc-1",
      tenantId: TENANT_A,
      name: "Consulta",
      basePrice: 90000,
    });
    let capturedData;
    prisma.appointment.update.mockImplementation(async ({ data }) => {
      capturedData = data;
      return { ...BASE_APPT, finalPrice: 75000, ...data };
    });

    const app = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });
    await request(app)
      .patch("/api/dashboard/appointments/appt-1")
      .send({ serviceId: "svc-1" }); // no explicit finalPrice

    // finalPrice already set on appointment → should NOT be overwritten by service basePrice
    expect(capturedData.finalPrice).toBeUndefined();
  });
});
