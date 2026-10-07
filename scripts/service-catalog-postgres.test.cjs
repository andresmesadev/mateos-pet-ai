const path = require("node:path");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const { NextRequest } = require("../frontend/node_modules/next/server");
require("../backend/node_modules/dotenv").config({ path: path.join(__dirname, "../backend/.env"), quiet: true });
const prisma = require("../backend/src/lib/prisma");
const express = require("../backend/node_modules/express");
const request = require("../backend/node_modules/supertest");
const { resolveServicePrice } = require("../backend/src/contexts/services");

test("catálogo real: editar precio base, conservar tarifa por mascota e historia, retirar y reactivar", async () => {
  const db = new URL(process.env.DATABASE_URL);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(db.hostname) && db.pathname === "/mateos_dev", "Requires local mateos_dev");
  const ids = [randomUUID(), randomUUID()];
  const created = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.tenant = { tenantId: ids[0], isSuperAdmin: false }; req.actor = { type: req.headers['x-test-staff'] ? "receptionist" : "admin" }; next(); });
  app.use("/api/dashboard", require("../backend/src/middleware/allowVeterinaryDashboard").allowVeterinaryDashboard);
  app.use("/api/dashboard", require("../backend/src/routes/dashboard/services.routes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  // Execute the actual Next handler with a test identity and an actual loopback backend.
  // This covers the authenticated adapter boundary, not just direct Express calls.
  const proxyContext = {
    exports: {}, URL, console, fetch,
    process: { env: { API_URL: `http://127.0.0.1:${server.address().port}`, INTERNAL_API_SECRET: "fixture-only-token" } },
    require: name => name === "@/auth" ? { auth: async () => ({ user: { tenantId: ids[0], isSuperAdmin: false } }) } : require("../frontend/node_modules/next/server"),
  };
  const proxySource = fs.readFileSync(path.join(__dirname, "../frontend/app/api/proxy/dashboard/[...path]/route.ts"), "utf8");
  vm.runInNewContext(ts.transpileModule(proxySource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, proxyContext);
  async function proxyDelete(serviceId, body, permanent = true) {
    const servicePath = ["services", serviceId, ...(permanent ? ["permanent"] : [])];
    const response = await proxyContext.exports.DELETE(new NextRequest(`http://localhost/api/proxy/dashboard/${servicePath.join("/")}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ path: servicePath }) });
    return response;
  }
  try {
    for (const id of ids) {
      await prisma.tenant.create({ data: { id, slug: `catalog-verification-${id}`, name: "Disposable catalog verification", phone: `channel-${id}`, activeModules: ["grooming", "veterinary"] } });
      created.push(id);
    }
    const category = await prisma.serviceCategory.create({ data: { tenantId: ids[0], name: "grooming", appliesCommissionSplit: true } });
    const service = await prisma.service.create({ data: { tenantId: ids[0], categoryId: category.id, name: "Fixture bath", duration: 60, basePrice: 55000 } });
    const owner = await prisma.user.create({ data: { tenantId: ids[0], phone: "000000008866", name: "Fixture owner" } });
    const pet = await prisma.pet.create({ data: { tenantId: ids[0], ownerId: owner.id, name: "Fixture pet", type: "dog" } });
    const agreed = await prisma.priceRule.create({ data: { serviceId: service.id, targetType: "pet", targetId: pet.id, price: 40000 } });
    const history = await prisma.appointment.create({ data: { tenantId: ids[0], userId: owner.id, petId: pet.id, petName: pet.name, petType: pet.type, serviceId: service.id, serviceType: "grooming", date: new Date("2026-01-01T14:00:00Z"), status: "completed", finalPrice: 55000 } });
    const response = await request(app).patch(`/api/dashboard/services/${service.id}`).send({ name: "Fixture updated bath", duration: 50, basePrice: 63000 });
    assert.equal(response.status, 200);
    assert.equal(response.body.name, "Fixture updated bath");
    assert.equal(response.body.duration, 50);
    assert.equal(Number(response.body.basePrice), 63000);
    assert.equal(Number((await resolveServicePrice({ tenantId: ids[0], serviceId: service.id })).finalPrice), 63000);
    assert.equal(Number((await resolveServicePrice({ tenantId: ids[0], serviceId: service.id, petId: pet.id })).finalPrice), 40000);
    assert.deepEqual(await prisma.priceRule.findUniqueOrThrow({ where: { id: agreed.id } }), agreed);
    assert.deepEqual(await prisma.appointment.findUniqueOrThrow({ where: { id: history.id } }), history);
    const duplicate = await request(app).post("/api/dashboard/services").send({ name: "Fixture updated bath", category: "grooming", duration: 50, basePrice: 63000 });
    assert.equal(duplicate.status, 409);
    const invalid = await request(app).patch(`/api/dashboard/services/${service.id}`).send({ name: "Invalid mutation", basePrice: -1 });
    assert.equal(invalid.status, 400);
    assert.equal((await prisma.service.findUniqueOrThrow({ where: { id: service.id } })).name, "Fixture updated bath");
    const added = await request(app).post("/api/dashboard/services").send({ name: "Fixture nuevo Baño", category: "grooming", duration: 20, basePrice: 12000 });
    assert.equal(added.status, 201);
    const permanentUrl = `/api/dashboard/services/${added.body.id}/permanent`;
    assert.equal((await request(app).delete(permanentUrl).send({ confirmName: added.body.name })).status, 409, "active service protected");
    assert.equal((await proxyDelete(added.body.id, undefined, false)).status, 204, "DELETE without body still retires service");
    assert.equal((await request(app).delete(permanentUrl).set('x-test-staff', '1').send({ confirmName: added.body.name })).status, 403, "administration only");
    assert.equal((await request(app).delete(permanentUrl).send({ confirmName: 'wrong name' })).status, 409);
    assert.equal((await proxyDelete(added.body.id, { confirmName: "incorrecto" })).status, 409, "proxy keeps confirmation validation");
    assert.equal((await proxyDelete(added.body.id, { confirmName: added.body.name })).status, 204, "actual Next proxy forwards DELETE body");
    assert.equal(await prisma.service.findUnique({ where: { id: added.body.id } }), null, "physical deletion");
    assert((await prisma.domainEvent.count({ where: { tenantId: ids[0] } })) > 0, "audit retained");
    const foreignCategory = await prisma.serviceCategory.create({ data: { tenantId: ids[1], name: "grooming" } });
    const foreign = await prisma.service.create({ data: { tenantId: ids[1], categoryId: foreignCategory.id, name: "Foreign untouched", duration: 30, basePrice: 33000 } });
    assert.equal((await request(app).patch(`/api/dashboard/services/${foreign.id}`).send({ basePrice: 1 })).status, 404);
    assert.equal((await request(app).delete(`/api/dashboard/services/${foreign.id}`)).status, 404);
    assert.equal((await request(app).delete(`/api/dashboard/services/${foreign.id}/permanent`).send({ confirmName: foreign.name })).status, 404);
    assert.deepEqual(await prisma.service.findUniqueOrThrow({ where: { id: foreign.id } }), foreign);
    assert.equal((await request(app).delete(`/api/dashboard/services/${service.id}`)).status, 204);
    assert.equal((await prisma.service.findUniqueOrThrow({ where: { id: service.id } })).active, false);
    assert.equal((await request(app).delete(`/api/dashboard/services/${service.id}/permanent`).send({ confirmName: "Fixture updated bath" })).status, 409, "history and agreed prices protected");
    assert.deepEqual(await prisma.appointment.findUniqueOrThrow({ where: { id: history.id } }), history);
    assert.deepEqual(await prisma.priceRule.findUniqueOrThrow({ where: { id: agreed.id } }), agreed);
    assert.equal((await request(app).patch(`/api/dashboard/services/${service.id}`).send({ active: true })).status, 200);
    assert.equal(Number((await resolveServicePrice({ tenantId: ids[0], serviceId: service.id, petId: pet.id })).finalPrice), 40000);
    const staff = await prisma.staff.create({ data: { tenantId: ids[0], name: "Fixture groomer", role: "groomer" } });
    const linked = await prisma.service.create({ data: { tenantId: ids[0], categoryId: category.id, name: "Fixture staff link", duration: 30, basePrice: 1, active: false } });
    const { PrismaStaffCapabilityRepository } = require("../backend/src/contexts/staff/infrastructure/persistence/prisma-staff-capability.repository");
    const staffRepository = new PrismaStaffCapabilityRepository();
    await staffRepository.create({ staffId: staff.id, serviceId: linked.id, active: false });
    assert.equal((await request(app).delete(`/api/dashboard/services/${linked.id}/permanent`).send({ confirmName: linked.name })).status, 409, "revoked staff references protected");
    await assert.rejects(staffRepository.create({ staffId: staff.id, serviceId: added.body.id }), { code: "REFERENCED_SERVICE_NOT_FOUND" });
    const priced = await prisma.service.create({ data: { tenantId: ids[0], categoryId: category.id, name: "Fixture inactive price", duration: 30, basePrice: 1, active: false } });
    await prisma.priceRule.create({ data: { serviceId: priced.id, targetType: "pet", targetId: pet.id, price: 1, active: false } });
    assert.equal((await request(app).delete(`/api/dashboard/services/${priced.id}/permanent`).send({ confirmName: priced.name })).status, 409, "inactive price rule alone protects service");
    const racing = await prisma.service.create({ data: { tenantId: ids[0], categoryId: category.id, name: "Fixture concurrent reference", duration: 30, basePrice: 1, active: false } });
    const [deletion, assignment] = await Promise.allSettled([
      request(app).delete(`/api/dashboard/services/${racing.id}/permanent`).send({ confirmName: racing.name }).then(response => response),
      staffRepository.create({ staffId: staff.id, serviceId: racing.id }),
    ]);
    assert.equal(deletion.status, "fulfilled");
    if (assignment.status === "fulfilled") {
      assert.equal(deletion.value.status, 409);
      assert(await prisma.service.findUnique({ where: { id: racing.id } }));
    } else {
      assert.equal(assignment.reason.code, "REFERENCED_SERVICE_NOT_FOUND");
      assert.equal(deletion.value.status, 204);
      assert.equal(await prisma.staffCapability.count({ where: { serviceId: racing.id } }), 0);
    }
    console.log("PASS: proxy Next real → Express → PostgreSQL: DELETE conserva confirmName y elimina; validación, permisos, aislamiento, tarifas, historia y concurrencia protegidos.");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await prisma.$transaction(async (tx) => {
      assert.equal(await tx.eventDelivery.count({ where: { domainEvent: { tenantId: { in: created } } } }), 0);
      assert.equal(await tx.automationExecution.count({ where: { domainEvent: { tenantId: { in: created } } } }), 0);
      await tx.domainEvent.deleteMany({ where: { tenantId: { in: created } } });
      await tx.appointment.deleteMany({ where: { tenantId: { in: created } } });
      await tx.priceRule.deleteMany({ where: { service: { tenantId: { in: created } } } });
      await tx.staffCapability.deleteMany({ where: { staff: { tenantId: { in: created } } } });
      await tx.staff.deleteMany({ where: { tenantId: { in: created } } });
      await tx.service.deleteMany({ where: { tenantId: { in: created } } });
      await tx.serviceCategory.deleteMany({ where: { tenantId: { in: created } } });
      await tx.pet.deleteMany({ where: { tenantId: { in: created } } });
      await tx.user.deleteMany({ where: { tenantId: { in: created } } });
      await tx.tenant.deleteMany({ where: { id: { in: created } } });
    });
    assert.equal(await prisma.tenant.count({ where: { id: { in: ids } } }), 0);
    await prisma.$disconnect();
  }
});
