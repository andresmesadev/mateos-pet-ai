const express = require("express"), request = require("supertest");
jest.mock("../../lib/prisma", () => ({ tenant: { findUnique: jest.fn() }, appointment: { findFirst: jest.fn() } }));
const prisma = require("../../lib/prisma");
const { allowVeterinaryDashboard } = require("../../middleware/allowVeterinaryDashboard");
const { dashboardOperationScope } = require("../../middleware/dashboard-operation-scope");
const { effectiveAccess, operationalPet } = require("../../services/dashboard-access.service");
const roles = ["admin", "receptionist", "vet", "groomer"];
const combinations = [["veterinary"], ["grooming"], ["retail"], ["veterinary", "grooming"], ["veterinary", "retail"], ["grooming", "retail"], ["veterinary", "grooming", "retail"]];
function app(role, permissions = []) {
  const result = express(); result.use(express.json());
  result.use((req, res, next) => { req.tenant = { tenantId: "tenant-a" }; req.actor = { type: role, staffId: "staff-a", accessPermissions: permissions }; next(); });
  result.use(allowVeterinaryDashboard, (req, res) => res.json(req.access));
  return result;
}
beforeEach(() => { jest.resetAllMocks(); prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["veterinary", "grooming", "retail"] }); });
describe.each(combinations.map(modules => [modules.join("+"), modules]))("modules %s", (_name, modules) => {
  test.each(roles)("%s receives only allowed areas and actions", async role => {
    prisma.tenant.findUnique.mockResolvedValue({ activeModules: modules });
    const client = app(role), expected = effectiveAccess({ type: role }, modules);
    for (const [path, capability] of [["/appointments/week", "agenda"], ["/appointments", "schedule"], ["/grooming/appointments/a/notes", "grooming"], ["/appointments/a/medical-record", "clinical"], ["/transactions", "cash"]]) {
      const response = path === "/appointments" ? await request(client).post(path).send({}) : path.includes("/notes") ? await request(client).put(path).send({}) : path.includes("medical-record") ? await request(client).put(path).send({}) : await request(client).get(path);
      expect(response.status).toBe((expected.capabilities[capability] || (role === "admin" && path === "/appointments/week")) ? 200 : 403);
    }
    const navigation = (await request(client).get("/access")).body.navigation;
    expect(navigation.includes("/dashboard/calendar")).toBe(expected.capabilities.agenda);
    expect(navigation.includes("/dashboard/pos")).toBe(expected.capabilities.cash);
    expect(navigation.includes("/dashboard/settings")).toBe(role === "admin");
  });
});
test.each(["vet", "groomer"])("%s can be granted cash without finance or catalogue access", async role => {
  const client = app(role, ["cash", "appointment_price"]);
  expect((await request(client).post("/transactions").send({})).status).toBe(200);
  expect((await request(client).patch("/appointments/a").send({ finalPrice: 40000 })).status).toBe(200);
  for (const path of ["/metrics/cashbox", "/metrics/revenue", "/expenses", "/commissions", "/staff", "/tenant/config"]) {
    const response = path === "/staff" ? await request(client).put(path).send({}) : await request(client).post(path).send({});
    expect(response.status).toBe(403);
  }
  expect((await request(client).patch("/appointments/a/agreed-price").send({ price: 40000 })).status).toBe(403);
  expect((await request(client).patch("/appointments/a").send({ finalPrice: 40000, status: "in_progress" })).status).toBe(403);
});
test("reception can collect but cannot complete a medical consultation or write history", async () => {
  const client = app("receptionist");
  expect((await request(client).patch("/appointments/a").send({ status: "arrived" })).status).toBe(200);
  expect((await request(client).post("/appointments/a/complete").send({})).status).toBe(403);
  expect((await request(client).put("/appointments/a/medical-record").send({})).status).toBe(403);
  expect((await request(client).patch("/appointments/a").send({ finalPrice: 10 })).status).toBe(403);
});
test("empty modules never silently reactivate appointments and unknown modules stay closed", async () => {
  prisma.tenant.findUnique.mockResolvedValue({ activeModules: [] });
  expect((await request(app("receptionist")).post("/appointments").send({})).status).toBe(403);
  expect(effectiveAccess({ type: "vet" }, ["unknown"]).capabilities.clinical).toBe(false);
});
test.each(["timeline", "report"])("clinical %s is available to vets and private from operational profiles", async endpoint => {
  for (const role of roles) {
    expect((await request(app(role)).get(`/pets/pet-a/${endpoint}`)).status).toBe(["admin", "vet"].includes(role) ? 200 : 403);
  }
  prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["grooming"] });
  expect((await request(app("vet")).get(`/pets/pet-a/${endpoint}`)).status).toBe(403);
  expect((await request(app("admin")).get(`/pets/pet-a/${endpoint}`)).status).toBe(200);
});
test("permission changes apply on the next request and configuration outages fail closed", async () => {
  const client = app("groomer");
  expect((await request(client).put("/grooming/appointments/a/notes").send({})).status).toBe(200);
  prisma.tenant.findUnique.mockResolvedValue({ activeModules: ["retail"] });
  expect((await request(client).put("/grooming/appointments/a/notes").send({})).status).toBe(403);
  prisma.tenant.findUnique.mockRejectedValue(new Error("offline"));
  expect((await request(client).get("/access")).status).toBe(503);
});
test("operational pet projection excludes clinical notes, prices, weight and history counts", () => {
  const pet = operationalPet({ id: "pet", name: "Toby", type: "dog", weight: 12, notes: "diagnosis", defaultGroomingPrice: 50000, medicalRecords: ["private"], operationalAlerts: "Manejo suave", _count: { medicalRecords: 3, appointments: 4 } });
  expect(pet.operationalAlerts).toBe("Manejo suave");
  for (const field of ["notes", "weight", "defaultGroomingPrice", "medicalRecords"]) expect(pet).not.toHaveProperty(field);
  expect(pet._count).toEqual({ appointments: 4 });
});
test("resource authorization scopes tenant, service module and assigned worker", async () => {
  const result = express(); result.use(express.json());
  result.use((req, res, next) => { req.tenant = { tenantId: "tenant-a" }; req.actor = { type: "groomer", staffId: "staff-a" }; req.access = effectiveAccess(req.actor, ["grooming"]); next(); });
  result.use(dashboardOperationScope, (req, res) => res.json({ ok: true }));
  prisma.appointment.findFirst.mockResolvedValue({ tenantId: "tenant-a", staffId: "staff-b", serviceType: "grooming" });
  expect((await request(result).patch("/appointments/a").send({ status: "in_progress" })).status).toBe(403);
  expect(prisma.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "a", tenantId: "tenant-a" } }));
  prisma.appointment.findFirst.mockResolvedValue({ tenantId: "tenant-a", staffId: "staff-a", serviceType: "vet" });
  expect((await request(result).post("/appointments/a/complete").send({})).status).toBe(403);
  prisma.appointment.findFirst.mockResolvedValue(null);
  expect((await request(result).patch("/appointments/a").send({ status: "in_progress" })).status).toBe(404);
});
