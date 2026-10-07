const assert = require("node:assert/strict");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { test } = require("node:test");
require("../backend/node_modules/dotenv").config({ path: path.join(__dirname, "../backend/.env"), quiet: true });
const prisma = require("../backend/src/lib/prisma");
const express = require("../backend/node_modules/express");
const request = require("../backend/node_modules/supertest");

test("Equipo: ficha, horario con minutos, permisos, acceso y aislamiento en PostgreSQL", async () => {
  const db = new URL(process.env.DATABASE_URL);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(db.hostname) && db.pathname === "/mateos_dev", "Requires local mateos_dev");
  const ids = [randomUUID(), randomUUID()], created = [];
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { tenantId: ids[0], isSuperAdmin: false };
    req.actor = { type: req.get("x-test-reception") ? "receptionist" : "admin", email: "owner@example.test" };
    next();
  });
  app.use("/api/dashboard", require("../backend/src/middleware/allowVeterinaryDashboard").allowVeterinaryDashboard);
  app.use("/api/dashboard", require("../backend/src/routes/dashboard/staff.routes"));
  try {
    for (const id of ids) { await prisma.tenant.create({ data: { id, slug: "team-test-" + id, name: "Equipo de prueba", phone: "test-" + id, activeModules: ["veterinary", "grooming", "retail"] } }); created.push(id); }
    const added = await request(app).post("/api/dashboard/staff").send({ name: "Integrante de prueba", role: "vet", email: "fixture@example.test" });
    assert.equal(added.status, 201); const id = added.body.id, url = "/api/dashboard/staff/" + id;
    assert.equal(added.body.availability, null, "new profile has no materialized schedule");
    assert.equal((await request(app).patch(url).send({ name: "Integrante actualizado", phone: "+573000000000" })).status, 200);
    const week = { mon: { active: true, open: "09:15", close: "15:10" }, tue: { active: false, open: "", close: "" } };
    assert.equal((await request(app).patch(url).send({ availability: week })).status, 200);
    assert.deepEqual((await prisma.staff.findUniqueOrThrow({ where: { id } })).availability, week);
    assert.equal(await prisma.staffAvailability.count({ where: { staffId: id, type: 'base_schedule' } }), 1, 'ADR 011: weekly base synchronized');
    for (const availability of [[], "bad", { mon: { active: true, open: "18:00", close: "09:00" } }, { monday: { active: true, open: "09:00", close: "10:00" } }, { mon: { active: true, open: "25:30", close: "26:00" } }]) {
      const invalid = await request(app).patch(url).send({ name: "Must not persist", availability });
      assert.equal(invalid.status, 400);
      const row = await prisma.staff.findUniqueOrThrow({ where: { id } });
      assert.equal(row.name, "Integrante actualizado"); assert.deepEqual(row.availability, week);
    }
    for (const body of [{ email: 42 }, { phone: {} }, { active: "false" }, { name: " " }]) assert.equal((await request(app).patch(url).send(body)).status, 400);
    assert.equal((await request(app).patch(url).send({ availability: null })).status, 200);
    assert.equal((await prisma.staff.findUniqueOrThrow({ where: { id } })).availability, null);
    assert.equal((await request(app).patch(url + "/access").send({ accessPermissions: ["cash", "cash", "inventory_consume"] })).status, 200);
    assert.deepEqual((await prisma.staff.findUniqueOrThrow({ where: { id } })).accessPermissions, ["cash", "inventory_consume"]);
    assert.equal((await request(app).patch(url + "/access").send({ accessPermissions: ["administration"] })).status, 400);
    assert.equal((await request(app).patch(url).set("x-test-reception", "1").send({ name: "Forbidden" })).status, 403);
    assert.equal((await request(app).patch(url + "/access").set("x-test-reception", "1").send({ accessPermissions: [] })).status, 403);
    const password = randomUUID(); // Disposable test credential; never used for a person.
    assert.equal((await request(app).put(url + "/credential").send({ email: "owner@example.test", password })).status, 422, "owner uses the existing administrator account");
    const credential = await request(app).put(url + "/credential").send({ email: id + "@example.test", password });
    assert.equal(credential.status, 200); assert.deepEqual(Object.keys(credential.body).sort(), ["active", "email"]);
    const metadata = (await request(app).get("/api/dashboard/staff")).body.find(row => row.id === id).credential;
    assert.deepEqual(Object.keys(metadata).sort(), ["active", "email"]);
    const safeRows = await request(app).get("/api/dashboard/staff").set("x-test-reception", "1");
    assert.equal(safeRows.status, 200); assert(!("credential" in safeRows.body[0]));
    assert.equal((await request(app).patch(url).send({ active: false })).status, 200);
    assert.equal((await request(app).put(url + "/credential").send({ email: id + "@example.test", password })).status, 422);
    assert.equal((await request(app).patch(url).send({ active: true })).status, 200);
    assert.equal((await request(app).delete(url + "/credential")).status, 204);
    assert.equal((await prisma.staffCredential.findUniqueOrThrow({ where: { staffId: id } })).active, false);
    const foreign = await prisma.staff.create({ data: { tenantId: ids[1], name: "Otro establecimiento", role: "groomer" } });
    for (const route of ["", "/access"]) assert.equal((await request(app).patch("/api/dashboard/staff/" + foreign.id + route).send(route ? { accessPermissions: ["cash"] } : { active: false })).status, 404);
    assert.equal((await request(app).delete("/api/dashboard/staff/" + foreign.id + "/credential")).status, 404);
    assert.deepEqual(await prisma.staff.findUniqueOrThrow({ where: { id: foreign.id } }), foreign);
    assert.equal(await prisma.staffAvailability.count({ where: { staffId: id } }), 0, "ADR 011: reset removes only weekly base");
    console.log("PASS: altas y cambios reales; horario 09:15–15:10 y reset; validación antes de escribir; permisos por rol; acceso revocado; sin hashes expuestos; aislamiento entre establecimientos.");
  } finally {
    await prisma.$transaction(async tx => {
      const scope = { tenantId: { in: created } };
      assert.equal(await tx.eventDelivery.count({ where: { domainEvent: scope } }), 0);
      assert.equal(await tx.automationExecution.count({ where: { domainEvent: scope } }), 0);
      await tx.domainEvent.deleteMany({ where: scope });
      await tx.staffCredential.deleteMany({ where: { staff: scope } });
      await tx.staff.deleteMany({ where: scope });
      await tx.tenant.deleteMany({ where: { id: { in: created } } });
    });
    await prisma.$disconnect();
    console.log("PASS: establecimientos e integrantes temporales eliminados.");
  }
});
