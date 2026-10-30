const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({ tenant: { create: jest.fn(), findUnique: jest.fn() } }));
jest.mock("express-rate-limit", () => () => (_req, _res, next) => next());
jest.mock("../../services/tenant-provisioning.service", () => ({ provisionDefaultDigitalEmployees: jest.fn() }));

const prisma = require("../../lib/prisma");
const { verifyPassword } = require("../../services/staff-credential.service");
const { registrationInput } = require("../../services/onboarding-registration.service");
const { provisionDefaultDigitalEmployees } = require("../../services/tenant-provisioning.service");
const router = require("../../routes/onboarding.routes");
const input = { name: "Clínica X", slug: "clinica-x", ownerName: "Nombre de prueba", email: "owner@example.test", password: "Una frase de prueba 123", activeModules: ["veterinary"] };
const tenant = { id: "tenant-1", name: input.name, slug: input.slug, plan: "free", phone: "private-channel", stripeCustomerId: "private-customer", secret: "internal" };

function app() {
  const instance = express(); instance.use(express.json()); instance.use("/api/onboarding", router); return instance;
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.tenant.create.mockResolvedValue(tenant);
  prisma.tenant.findUnique.mockResolvedValue(null);
  provisionDefaultDigitalEmployees.mockResolvedValue({ results: [] });
});

test("creates an administrator atomically with normalized email, real hash and no channel or global access", async () => {
  const result = await request(app()).post("/api/onboarding/register").send({ ...input, email: " OWNER@EXAMPLE.TEST " });
  expect(result.status).toBe(201);
  const write = prisma.tenant.create.mock.calls[0][0];
  expect(write.select).toEqual({ id: true, name: true, slug: true, plan: true });
  expect(write.data).not.toHaveProperty("phone");
  expect(write.data.plan).toBe("free");
  expect(Object.keys(write.data.businessHours)).toHaveLength(7);
  expect(Object.values(write.data.businessHours).every(day => day.active === false && day.open === "" && day.close === "")).toBe(true);
  const staff = write.data.staff.create;
  expect(staff).toMatchObject({ name: input.ownerName, email: input.email, role: "admin", serviceScope: "selected", generatesCommission: false });
  expect(staff.credential.create.email).toBe(input.email);
  expect(await verifyPassword(input.password, staff.credential.create.passwordHash)).toBe(true);
  expect(result.body).toEqual({ tenant: { name: tenant.name, slug: tenant.slug, plan: "free" }, provisioning: "ready" });
  expect(JSON.stringify(result.body)).not.toMatch(/private|password|internal|tenant-1/);
  expect(result.headers["cache-control"]).toBe("no-store");
  expect(provisionDefaultDigitalEmployees).toHaveBeenCalledWith(tenant.id);
});

test("provisioning failure preserves the account without exposing internal errors", async () => {
  provisionDefaultDigitalEmployees.mockRejectedValue(new Error("private infrastructure details"));
  const result = await request(app()).post("/api/onboarding/register").send(input);
  expect(result.status).toBe(201);
  expect(result.body.provisioning).toBe("pending");
  expect(JSON.stringify(result.body)).not.toContain("private");
});

test("partial provisioning failure is reported as pending", async () => {
  provisionDefaultDigitalEmployees.mockResolvedValue({ results: [{ error: "private" }] });
  const result = await request(app()).post("/api/onboarding/register").send(input);
  expect(result.status).toBe(201); expect(result.body.provisioning).toBe("pending");
});

test.each(["email", "slug"])("a duplicate %s never provisions employees or reveals the existing account", async (field) => {
  prisma.tenant.create.mockRejectedValue(Object.assign(new Error("private"), { code: "P2002", meta: { target: [field] } }));
  const result = await request(app()).post("/api/onboarding/register").send(input);
  expect(result.status).toBe(409);
  expect(result.body).not.toHaveProperty("tenant");
  expect(result.body.error).not.toContain("private");
  expect(provisionDefaultDigitalEmployees).not.toHaveBeenCalled();
});

test.each([
  { name: " " }, { name: "x".repeat(121) }, { slug: "-bad" }, { slug: "bad-" }, { slug: "bad/slug" },
  { ownerName: " " }, { email: "invalid@" }, { password: "short" }, { password: "x".repeat(129) },
  { activeModules: [] }, { activeModules: ["invented"] }, { activeModules: ["retail", "retail"] },
  { tenantId: "foreign" }, { userId: "foreign" }, { role: "superadmin" }, { plan: "pro" }, { phone: "forged-channel" },
])("invalid input is rejected before persistence: %j", async patch => {
  const result = await request(app()).post("/api/onboarding/register").send({ ...input, ...patch });
  expect(result.status).toBe(400);
  expect(prisma.tenant.create).not.toHaveBeenCalled();
  expect(provisionDefaultDigitalEmployees).not.toHaveBeenCalled();
});

test("all seven valid module combinations preserve explicit selection", () => {
  const modules = ["veterinary", "grooming", "retail"];
  for (let mask = 1; mask < 8; mask++) {
    const selected = modules.filter((_, i) => mask & (1 << i));
    expect(registrationInput({ ...input, activeModules: selected }).activeModules).toEqual(selected);
  }
});

test("platform administrator email is reserved", async () => {
  const previous = process.env.ADMIN_EMAIL; process.env.ADMIN_EMAIL = "OWNER@example.test";
  try {
    const result = await request(app()).post("/api/onboarding/register").send(input);
    expect(result.status).toBe(409); expect(prisma.tenant.create).not.toHaveBeenCalled();
  } finally { if (previous === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = previous; }
});

test("unexpected persistence failures give a recovery instruction without leaking details", async () => {
  prisma.tenant.create.mockRejectedValue(new Error("private database string"));
  const result = await request(app()).post("/api/onboarding/register").send(input);
  expect(result.status).toBe(503); expect(result.body.error).toMatch(/iniciar sesión/);
  expect(JSON.stringify(result.body)).not.toContain("private");
});

test("availability validates the identifier and only returns a boolean", async () => {
  expect((await request(app()).get("/api/onboarding/verify/-bad")).status).toBe(400);
  expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  expect((await request(app()).get("/api/onboarding/verify/new-clinic")).body).toEqual({ available: true });
  prisma.tenant.findUnique.mockResolvedValue({ id: "private" });
  expect((await request(app()).get("/api/onboarding/verify/new-clinic")).body).toEqual({ available: false });
});
