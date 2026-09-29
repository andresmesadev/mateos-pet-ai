const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  pet: { findFirst: jest.fn() },
  petNextAction: { findMany: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const routes = require("../../routes/dashboard/pets.routes");

function app() {
  const server = express();
  server.use((req, _res, next) => { req.tenant = { tenantId: "tenant-a" }; next(); });
  server.use("/api/dashboard", routes);
  return server;
}

beforeEach(() => jest.clearAllMocks());

test("each upcoming follow-up carries the pet ID needed for its profile link", async () => {
  prisma.petNextAction.findMany.mockResolvedValue([{
    id: "action-1", petId: "pet-1", type: "vaccine", notes: null,
    dueAt: new Date("2026-09-29T15:00:00Z"), pet: { name: "Luna", type: "cat" },
  }]);

  const response = await request(app()).get("/api/dashboard/next-actions/upcoming?limit=6");
  expect(response.status).toBe(200);
  expect(response.body[0]).toMatchObject({ id: "action-1", petId: "pet-1", petName: "Luna" });
  expect(prisma.petNextAction.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { tenantId: "tenant-a", status: "pending" },
  }));
});

test("a linked pet profile is fetched within the active tenant", async () => {
  prisma.pet.findFirst.mockResolvedValue({
    id: "pet-1", name: "Luna", type: "cat", owner: { id: "owner-1", name: "Ana", phone: "3000000000" },
    _count: { medicalRecords: 2, appointments: 1 },
  });

  const response = await request(app()).get("/api/dashboard/pets/pet-1");
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ id: "pet-1", name: "Luna", owner: { name: "Ana" } });
  expect(prisma.pet.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "pet-1", tenantId: "tenant-a" },
  }));
});

test("a pet outside the active tenant cannot be opened from a follow-up", async () => {
  prisma.pet.findFirst.mockResolvedValue(null);
  const response = await request(app()).get("/api/dashboard/pets/other-tenant-pet");
  expect(response.status).toBe(404);
});
