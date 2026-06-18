const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  user: { create: jest.fn(), findFirst: jest.fn() },
  pet: { create: jest.fn() },
}));

jest.mock("../../services/dashboard-client.service", () => ({
  listClients: jest.fn(),
  getClientById: jest.fn(),
  updateClient: jest.fn(),
  listInactiveClients: jest.fn(),
}));
jest.mock("../../services/whatsapp-api.service", () => ({ sendWhatsAppMessage: jest.fn() }));
jest.mock("../../services/next-action.service", () => ({
  VALID_TYPES: ["control", "vaccine", "grooming", "exam", "treatment", "other"],
  listNextActions: jest.fn(),
  createNextAction: jest.fn(),
  updateNextAction: jest.fn(),
  pendingActionsSummary: jest.fn(),
  sendNextActionReminders: jest.fn(),
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

describe("POST /api/dashboard/clients", () => {
  beforeEach(() => jest.clearAllMocks());

  it("requires phone", async () => {
    const res = await request(app).post("/api/dashboard/clients").send({ name: "Ana" });
    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates a client scoped to the tenant", async () => {
    prisma.user.create.mockResolvedValue({ id: "u1", name: "Ana", phone: "573001112233" });
    const res = await request(app)
      .post("/api/dashboard/clients")
      .send({ name: "Ana", phone: "57 300 111 2233" });
    expect(res.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: "573001112233", tenantId: TENANT_ID }),
      })
    );
  });

  it("returns 409 on duplicate phone", async () => {
    prisma.user.create.mockRejectedValue({ code: "P2002" });
    const res = await request(app)
      .post("/api/dashboard/clients")
      .send({ phone: "573001112233" });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/dashboard/pets", () => {
  beforeEach(() => jest.clearAllMocks());

  it("validates name, type and owner phone", async () => {
    expect((await request(app).post("/api/dashboard/pets").send({ type: "dog", ownerPhone: "1" })).status).toBe(400);
    expect((await request(app).post("/api/dashboard/pets").send({ name: "Max", type: "lizard", ownerPhone: "1" })).status).toBe(400);
    expect((await request(app).post("/api/dashboard/pets").send({ name: "Max", type: "dog" })).status).toBe(400);
  });

  it("links to an existing owner", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "owner-1" });
    prisma.pet.create.mockResolvedValue({ id: "p1", name: "Max", type: "dog" });
    const res = await request(app)
      .post("/api/dashboard/pets")
      .send({ name: "Max", type: "dog", ownerPhone: "573001112233" });
    expect(res.status).toBe(201);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.pet.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerId: "owner-1", tenantId: TENANT_ID }) })
    );
  });

  it("creates the owner when not found (find-or-create)", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: "owner-new" });
    prisma.pet.create.mockResolvedValue({ id: "p2", name: "Luna", type: "cat" });
    const res = await request(app)
      .post("/api/dashboard/pets")
      .send({ name: "Luna", type: "cat", ownerPhone: "573009998877", ownerName: "Pedro" });
    expect(res.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.pet.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerId: "owner-new" }) })
    );
  });
});
