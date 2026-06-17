const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  pet: { findFirst: jest.fn() },
  petNextAction: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
}));

const prisma = require("../../lib/prisma");
const dashboardRoutes = require("../../routes/dashboard.routes");

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function buildApp(tenantId = TENANT_A, isSuperAdmin = false) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin, tenantId };
    next();
  });
  app.use("/api/dashboard", dashboardRoutes);
  return app;
}

const app = buildApp();

const petA = { id: "pet-1", tenantId: TENANT_A };

const pendingControl = {
  id: "action-1",
  petId: "pet-1",
  tenantId: TENANT_A,
  type: "control",
  notes: "Control mensual",
  dueAt: new Date("2026-07-01T12:00:00.000Z"),
  status: "pending",
  sourceRecordId: null,
  sourceAppointmentId: null,
  createdAt: new Date("2026-06-17T00:00:00.000Z"),
  updatedAt: new Date("2026-06-17T00:00:00.000Z"),
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.pet.findFirst.mockResolvedValue(petA);
  prisma.petNextAction.findMany.mockResolvedValue([pendingControl]);
  prisma.petNextAction.findFirst.mockResolvedValue(pendingControl);
  prisma.petNextAction.create.mockResolvedValue({ ...pendingControl, id: "action-new" });
  prisma.petNextAction.update.mockResolvedValue({ ...pendingControl, status: "done" });
});

// ── GET /pets/:id/next-actions ──────────────────────────────────

describe("GET /api/dashboard/pets/:id/next-actions", () => {
  test("returns 404 if pet does not belong to tenant", async () => {
    prisma.pet.findFirst.mockResolvedValue(null);
    const res = await request(app).get("/api/dashboard/pets/pet-1/next-actions");
    expect(res.status).toBe(404);
    expect(prisma.petNextAction.findMany).not.toHaveBeenCalled();
  });

  test("returns pending actions for the pet", async () => {
    const res = await request(app).get("/api/dashboard/pets/pet-1/next-actions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: "action-1", type: "control", status: "pending" });
  });

  test("passes tenantId to findMany", async () => {
    await request(app).get("/api/dashboard/pets/pet-1/next-actions");
    expect(prisma.petNextAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) })
    );
  });
});

// ── POST /pets/:id/next-actions ─────────────────────────────────

describe("POST /api/dashboard/pets/:id/next-actions", () => {
  test("returns 404 if pet does not belong to tenant", async () => {
    prisma.pet.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/dashboard/pets/pet-1/next-actions")
      .send({ type: "control", dueAt: "2026-07-10" });
    expect(res.status).toBe(404);
    expect(prisma.petNextAction.create).not.toHaveBeenCalled();
  });

  test("creates a new pending action", async () => {
    const res = await request(app)
      .post("/api/dashboard/pets/pet-1/next-actions")
      .send({ type: "vaccine", dueAt: "2026-07-15", notes: "Antirrábica" });
    expect(res.status).toBe(201);
    expect(prisma.petNextAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ petId: "pet-1", type: "vaccine", tenantId: TENANT_A }),
      })
    );
  });

  test("returns 400 for invalid type", async () => {
    const res = await request(app)
      .post("/api/dashboard/pets/pet-1/next-actions")
      .send({ type: "bath", dueAt: "2026-07-10" });
    expect(res.status).toBe(400);
    expect(prisma.petNextAction.create).not.toHaveBeenCalled();
  });

  test("returns 400 when dueAt is missing", async () => {
    const res = await request(app)
      .post("/api/dashboard/pets/pet-1/next-actions")
      .send({ type: "control" });
    expect(res.status).toBe(400);
  });
});

// ── PATCH /next-actions/:id ─────────────────────────────────────

describe("PATCH /api/dashboard/next-actions/:id", () => {
  test("marks action as done", async () => {
    const res = await request(app)
      .patch("/api/dashboard/next-actions/action-1")
      .send({ status: "done" });
    expect(res.status).toBe(200);
    expect(prisma.petNextAction.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "action-1" }, data: expect.objectContaining({ status: "done" }) })
    );
  });

  test("marks action as dismissed", async () => {
    const res = await request(app)
      .patch("/api/dashboard/next-actions/action-1")
      .send({ status: "dismissed" });
    expect(res.status).toBe(200);
  });

  test("returns 404 if action does not belong to tenant", async () => {
    prisma.petNextAction.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .patch("/api/dashboard/next-actions/action-1")
      .send({ status: "done" });
    expect(res.status).toBe(404);
    expect(prisma.petNextAction.update).not.toHaveBeenCalled();
  });

  test("returns 400 for invalid status", async () => {
    const res = await request(app)
      .patch("/api/dashboard/next-actions/action-1")
      .send({ status: "gone" });
    expect(res.status).toBe(400);
    expect(prisma.petNextAction.update).not.toHaveBeenCalled();
  });
});

// ── GET /next-actions/summary ───────────────────────────────────

describe("GET /api/dashboard/next-actions/summary", () => {
  beforeEach(() => {
    prisma.petNextAction.groupBy.mockResolvedValue([
      { type: "control", _count: { id: 3 } },
      { type: "vaccine", _count: { id: 1 } },
    ]);
    prisma.petNextAction.findMany.mockResolvedValue([
      { petId: "pet-1" },
      { petId: "pet-2" },
    ]);
  });

  test("returns total count and breakdown by type", async () => {
    const res = await request(app).get("/api/dashboard/next-actions/summary");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 4,
      byType: { control: 3, vaccine: 1 },
    });
  });

  test("counts distinct overdue pets", async () => {
    const res = await request(app).get("/api/dashboard/next-actions/summary");
    expect(res.body.overduePets).toBe(2);
  });

  test("scopes to tenant", async () => {
    await request(app).get("/api/dashboard/next-actions/summary");
    expect(prisma.petNextAction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) })
    );
  });
});
