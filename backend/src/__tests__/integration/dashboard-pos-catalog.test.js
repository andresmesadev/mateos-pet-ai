const express = require("express"), request = require("supertest");
jest.mock("../../lib/prisma", () => ({ tenant: { findUnique: jest.fn() }, pet: { findFirst: jest.fn() }, service: { findMany: jest.fn() } }));
const prisma = require("../../lib/prisma");
const { allowVeterinaryDashboard } = require("../../middleware/allowVeterinaryDashboard");
const routes = require("../../routes/dashboard/access.routes");
function app(role = "receptionist", tenantId = "tenant-a", staffId = "staff-a", permissions = []) {
  const result = express();
  result.use((req, res, next) => { req.tenant = { tenantId }; req.actor = { type: role, staffId, accessPermissions: permissions }; next(); });
  result.use(allowVeterinaryDashboard, routes);
  return result;
}
beforeEach(() => {
  jest.resetAllMocks();
  prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["grooming", "veterinary"] });
  prisma.pet.findFirst.mockResolvedValue({ id: "pet-a", defaultGroomingPrice: 55000 });
  prisma.service.findMany.mockResolvedValue([
    { id: "bath", name: "Baño", category: { name: "grooming" }, basePrice: 42000, priceRules: [{ price: 61000 }] },
    { id: "cut", name: "Corte", category: { name: "grooming" }, basePrice: 40000, priceRules: [] },
    { id: "vet", name: "Consulta", category: { name: "veterinary" }, basePrice: 66000, priceRules: [] },
  ]);
});
test("draft scope differs by actor, effective establishment and credential version; query cannot forge it", async () => {
  const first = (await request(app()).get("/cash/context")).body.draftScope;
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect((await request(app()).get("/cash/context?tenantId=other&staffId=other")).body.draftScope).toBe(first);
  expect((await request(app("receptionist", "tenant-b")).get("/cash/context")).body.draftScope).not.toBe(first);
  expect((await request(app("receptionist", "tenant-a", "staff-b")).get("/cash/context")).body.draftScope).not.toBe(first);
  expect((await request(app()).get("/cash/context").set("x-staff-session-version", "2")).body.draftScope).not.toBe(first);
  expect((await request(app("admin", "tenant-a", null)).get("/cash/context")).status).toBe(403);
});
test.each(["vet", "groomer"])("%s needs cash permission for draft context/catalog", async role => {
  for (const endpoint of ["/cash/context", "/cash/catalog"]) {
    expect((await request(app(role)).get(endpoint)).status).toBe(403);
    expect((await request(app(role, "tenant-a", "staff-a", ["cash"])).get(endpoint)).status).toBe(200);
  }
});
test("catalog uses pet agreement, grooming-only default and base price through the domain resolver", async () => {
  const response = await request(app()).get("/cash/catalog?petId=pet-a");
  expect(response.status).toBe(200);
  expect(response.body.map(row => [row.price, row.priceSource])).toEqual([[61000, "pet_agreed_price"], [55000, "pet_default_price"], [66000, "service_base_price"]]);
  expect(prisma.pet.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "pet-a", tenantId: "tenant-a" } }));
  expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-a", active: true } }));
});
test("catalog excludes disabled modules and returns no services to a retail-only establishment", async () => {
  prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["grooming"] });
  expect((await request(app()).get("/cash/catalog")).body.map(row => row.id)).toEqual(["bath", "cut"]);
  prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["retail"] });
  expect((await request(app()).get("/cash/catalog")).body).toEqual([]);
});
test("cross-tenant or malformed pet cannot supply a price; unavailable database fails explicitly", async () => {
  prisma.pet.findFirst.mockResolvedValue(null);
  expect((await request(app()).get("/cash/catalog?petId=foreign")).status).toBe(404);
  expect(prisma.service.findMany).not.toHaveBeenCalled();
  expect((await request(app()).get("/cash/catalog?petId=a&petId=b")).status).toBe(400);
  prisma.service.findMany.mockRejectedValue(new Error("offline"));
  expect((await request(app()).get("/cash/catalog")).status).toBe(503);
});
test("reception and professionals with cash cannot invoke the administrator void command", async () => {
  for (const role of ["receptionist", "vet", "groomer"]) {
    expect((await request(app(role, "tenant-a", "staff-a", ["cash"])).post("/transactions/sale/void").send({ reason: "x" })).status).toBe(403);
  }
});
