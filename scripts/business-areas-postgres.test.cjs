const path = require("node:path");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { randomUUID } = require("node:crypto");
const root = path.join(__dirname, "..");
require("../backend/node_modules/dotenv").config({ path: path.join(root, "backend/.env"), quiet: true });
const express = require("../backend/node_modules/express");
const request = require("../backend/node_modules/supertest");
const prisma = require("../backend/src/lib/prisma");
const { effectiveAccess } = require("../backend/src/services/dashboard-access.service");

test("PostgreSQL: siete combinaciones, navegación real por perfil, aislamiento e historial conservado", async () => {
  const db = new URL(process.env.DATABASE_URL);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(db.hostname) && db.pathname === "/mateos_dev", "Requires local mateos_dev");
  const ids = [randomUUID(), randomUUID()];
  const created = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.tenant = { tenantId: ids[0], isSuperAdmin: false }; req.actor = { type: "admin" }; next(); });
  app.use("/api/dashboard", require("../backend/src/routes/dashboard/tenant.routes"));
  try {
    for (const id of ids) {
      await prisma.tenant.create({ data: { id, slug: `areas-verification-${id}`, name: "Areas verification", phone: `channel-${id}`, activeModules: ["veterinary", "grooming", "retail"] } });
      created.push(id);
    }
    const owner = await prisma.user.create({ data: { tenantId: ids[0], phone: "000000008877", name: "Fixture owner" } });
    const pet = await prisma.pet.create({ data: { tenantId: ids[0], ownerId: owner.id, name: "Fixture pet", type: "dog", notes: "Existing notes must survive module changes" } });
    const visit = await prisma.appointment.create({ data: { tenantId: ids[0], userId: owner.id, petId: pet.id, petName: pet.name, petType: pet.type, serviceType: "grooming", date: new Date("2026-01-01T14:00:00Z"), status: "completed" } });
    for (const modules of [["veterinary"], ["grooming"], ["retail"], ["veterinary", "grooming"], ["veterinary", "retail"], ["grooming", "retail"], ["veterinary", "grooming", "retail"]]) {
      const response = await request(app).put("/api/dashboard/tenant/config").send({ activeModules: modules, tenantId: ids[1] });
      assert.equal(response.status, 200);
      const persisted = (await request(app).get("/api/dashboard/tenant/profile")).body.activeModules;
      assert.deepEqual(persisted, modules);
      for (const role of ["admin", "vet", "groomer", "receptionist"]) {
        const access = effectiveAccess({ type: role }, persisted);
        assert.equal(access.navigation.includes("/dashboard/consultas"), modules.includes("veterinary") && ["admin", "vet"].includes(role));
        assert.equal(access.navigation.includes("/dashboard/peluqueria"), modules.includes("grooming") && ["admin", "groomer"].includes(role));
        assert.equal(access.navigation.includes("/dashboard/pos"), ["admin", "receptionist"].includes(role));
        assert.equal(access.navigation.includes("/dashboard/settings"), role === "admin");
        if (modules.length === 1 && modules[0] === "retail") assert.equal(access.navigation.includes("/dashboard/calendar"), false);
      }
      assert.deepEqual(await prisma.appointment.findUniqueOrThrow({ where: { id: visit.id } }), visit);
      assert.equal((await prisma.pet.findUniqueOrThrow({ where: { id: pet.id } })).notes, pet.notes);
    }
    assert.deepEqual((await prisma.tenant.findUniqueOrThrow({ where: { id: ids[1] } })).activeModules, ["veterinary", "grooming", "retail"]);
    const empty = await request(app).put("/api/dashboard/tenant/config").send({ activeModules: [] });
    assert.equal(empty.status, 400);
    assert.deepEqual((await prisma.tenant.findUniqueOrThrow({ where: { id: ids[0] } })).activeModules, ["veterinary", "grooming", "retail"]);
    console.log("PASS: 7 combinaciones persistidas, 4 perfiles comprobados, tenant ajeno e historial intactos, selección vacía rechazada.");
  } finally {
    await prisma.$transaction(async (tx) => {
      await tx.appointment.deleteMany({ where: { tenantId: { in: created } } });
      await tx.pet.deleteMany({ where: { tenantId: { in: created } } });
      await tx.user.deleteMany({ where: { tenantId: { in: created } } });
      await tx.tenant.deleteMany({ where: { id: { in: created } } });
    });
    assert.equal(await prisma.tenant.count({ where: { id: { in: ids } } }), 0);
    await prisma.$disconnect();
  }
});
