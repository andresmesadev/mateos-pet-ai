// Exercise the real HTTP adapter inside a rolled-back local transaction.
require("dotenv").config();
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const { randomUUID } = require("node:crypto");
const express = require("../backend/node_modules/express");
const request = require("../backend/node_modules/supertest");

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname), "Solo se permite una base local");
  const prisma = require("../backend/src/lib/prisma");
  const fixtureId = `grooming-check-${randomUUID()}`;
  const rollback = new Error("ROLLBACK_GROOMING_CHECK");
  try {
    const pet = await prisma.pet.findFirst({ where: { tenant: { activeModules: { has: "grooming" } } } });
    assert(pet, "Se necesita una mascota local de un establecimiento con peluquería");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.appointment.create({ data: { id: fixtureId, petId: pet.id, userId: pet.ownerId, tenantId: pet.tenantId, petName: "Verificación local", petType: pet.type, serviceType: "grooming", date: new Date(), status: "completed" } });
        const path = require.resolve("../backend/src/routes/dashboard/grooming.routes");
        const adapter = new Module(path, module);
        adapter.filename = path;
        adapter.paths = Module._nodeModulePaths(require("node:path").dirname(path));
        const originalRequire = adapter.require.bind(adapter);
        adapter.require = (name) => name === "../../lib/prisma" ? tx : originalRequire(name);
        adapter._compile(fs.readFileSync(path, "utf8"), path);
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => { req.tenant = { tenantId: pet.tenantId }; next(); });
        app.use("/api/dashboard", adapter.exports);
        const noteUrl = `/api/dashboard/grooming/appointments/${fixtureId}/notes`;
        const saved = await request(app).put(noteUrl).send({ notes: "Champú suave y corte redondeado. Verificación con rollback.", expectedVersion: 1 });
        assert.equal(saved.status, 200);
        assert.equal(saved.body.groomingNotesVersion, 2);
        assert.equal((await request(app).put(noteUrl).send({ notes: "No sobrescribir", expectedVersion: 1 })).status, 409);
        const history = await request(app).get(`/api/dashboard/grooming/pets/${pet.id}/notes`);
        assert.equal(history.status, 200);
        assert(history.body.visits.some((visit) => visit.id === fixtureId && visit.groomingNotes.includes("Champú")));
        const deliveryUrl = `/api/dashboard/grooming/appointments/${fixtureId}/delivery`;
        const first = await request(app).post(deliveryUrl);
        const second = await request(app).post(deliveryUrl);
        assert.equal(first.status, 200);
        assert.equal(second.status, 200);
        assert.equal(first.body.groomingDeliveredAt, second.body.groomingDeliveredAt);
        assert.equal(await tx.transaction.count({ where: { appointmentId: fixtureId } }), 0);
        assert.equal(await tx.commission.count({ where: { appointmentId: fixtureId } }), 0);
        throw rollback;
      }, { timeout: 20000 });
    } catch (error) { if (error !== rollback) throw error; }
    assert.equal(await prisma.appointment.findUnique({ where: { id: fixtureId } }), null);
    console.log("Grooming: real note save, conflict, history and idempotent delivery passed; no financial side effects; fixture rolled back.");
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
