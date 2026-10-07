const path = require("node:path");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { randomUUID } = require("node:crypto");
const root = path.join(__dirname, "..");
require("../backend/node_modules/dotenv").config({ path: path.join(root, "backend/.env"), quiet: true });
const express = require("../backend/node_modules/express");
const request = require("../backend/node_modules/supertest");
const prisma = require("../backend/src/lib/prisma");

test("PostgreSQL: contacto editable, canal intacto, aislamiento, vaciado y restricción física", async () => {
  const db = new URL(process.env.DATABASE_URL);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(db.hostname) && db.pathname === "/mateos_dev", "Requires local mateos_dev");
  const ids = [randomUUID(), randomUUID()];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.tenant = { tenantId: ids[0], isSuperAdmin: false }; req.actor = { type: "admin" }; next(); });
  app.use("/api/dashboard", require("../backend/src/routes/dashboard/tenant.routes"));
  const created = [];
  try {
    for (const id of ids) {
      await prisma.tenant.create({ data: { id, slug: `contact-verification-${id}`, name: "Contact verification", phone: `channel-${id}` } });
      created.push(id);
    }
    assert.equal((await request(app).get("/api/dashboard/tenant/profile")).body.contactPhone, null);
    const saved = await request(app).put("/api/dashboard/tenant/profile").send({ contactPhone: "+57 (300) 123-45.67", tenantId: ids[1] });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.contactPhone, "+573001234567");
    const reloaded = await request(app).get("/api/dashboard/tenant/profile");
    assert.equal(reloaded.body.contactPhone, "+573001234567");
    assert.equal(reloaded.body.phone, `channel-${ids[0]}`);
    assert.equal((await prisma.tenant.findUniqueOrThrow({ where: { id: ids[1] } })).contactPhone, null);
    assert.equal((await request(app).put("/api/dashboard/tenant/profile").send({ name: "Updated fixture" })).status, 200);
    assert.equal((await prisma.tenant.findUniqueOrThrow({ where: { id: ids[0] } })).contactPhone, "+573001234567");
    assert.equal((await request(app).put("/api/dashboard/tenant/profile").send({ contactPhone: "invalid", name: "Must not save" })).status, 400);
    assert.equal((await prisma.tenant.findUniqueOrThrow({ where: { id: ids[0] } })).name, "Updated fixture");
    assert.equal((await request(app).put("/api/dashboard/tenant/profile").send({ phone: "+573009876543" })).status, 400);
    await assert.rejects(prisma.$executeRaw`UPDATE "Tenant" SET "contactPhone" = 'invalid' WHERE "id" = ${ids[0]}`, /Tenant_contactPhone_format_check/);
    // A contact is not a unique inbound channel: establishments may share it.
    await prisma.tenant.update({ where: { id: ids[1] }, data: { contactPhone: "+573001234567" } });
    assert.equal((await request(app).put("/api/dashboard/tenant/profile").send({ contactPhone: "" })).status, 200);
    assert.equal((await request(app).get("/api/dashboard/tenant/profile")).body.contactPhone, null);
    console.log("PASS: perfil guardado y recargado, canal intacto, tenant ajeno intacto, omisión, vaciado y CHECK verificados.");
  } finally {
    for (const id of created) await prisma.tenant.delete({ where: { id } });
    assert.equal(await prisma.tenant.count({ where: { id: { in: ids } } }), 0);
    await prisma.$disconnect();
  }
});
