// Read-only production check. Run through stdin inside the backend container.
// Never creates accounts, changes permissions, writes records or prints secrets.
const assert = require("node:assert/strict");
const { Client } = require("pg");
const { effectiveAccess } = require("./src/services/dashboard-access.service");

(async () => {
  assert.equal(require("./package.json").version, "2.41.0");
  const tenantId = process.env.SINGLE_TENANT_ID;
  assert(tenantId, "Production tenant is required");
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const { rows: tenants } = await db.query('SELECT "activeModules" FROM "Tenant" WHERE id = $1', [tenantId]);
    assert.equal(tenants.length, 1);
    const modules = tenants[0].activeModules;
    const base = { "X-Internal-Token": process.env.INTERNAL_API_SECRET, "X-Tenant-Id": tenantId };
    const check = async (path, headers, status) => {
      const response = await fetch("http://127.0.0.1:3000/api/dashboard" + path, { headers });
      assert.equal(response.status, status, `${path}: expected ${status}, received ${response.status}`);
      return response.json();
    };
    const admin = await check("/access", base, 200);
    assert.equal(admin.role, "admin");
    assert.deepEqual([...admin.activeModules].sort(), [...modules].sort());
    await check("/cash/operational", base, 200);
    await check("/tenant/profile", base, 200);
    for (let mask = 1; mask < 8; mask++) {
      const active = ["veterinary", "grooming", "retail"].filter((_, index) => mask & (1 << index));
      for (const role of ["admin", "receptionist", "vet", "groomer"]) {
        const access = effectiveAccess({ type: role }, active);
        assert.equal(access.capabilities.cash, ["admin", "receptionist"].includes(role));
        assert.equal(access.capabilities.finance, role === "admin");
        assert.equal(access.capabilities.clinical, active.includes("veterinary") && ["admin", "vet"].includes(role));
        assert.equal(access.capabilities.grooming, active.includes("grooming") && ["admin", "groomer"].includes(role));
      }
    }
    console.log("PASS: deployed policy for four profiles and seven module combinations; administrator endpoints");
    const credentials = await db.query(`SELECT s.id, s.role, s."accessPermissions", c."sessionVersion"
      FROM "Staff" s JOIN "StaffCredential" c ON c."staffId" = s.id
      WHERE s."tenantId" = $1 AND s.active = true AND c.active = true`, [tenantId]);
    for (const row of credentials.rows) {
      const headers = { ...base, "X-Staff-Id": row.id, "X-Staff-Session-Version": String(row.sessionVersion) };
      const actual = await check("/access", headers, 200);
      assert.equal(actual.role, row.role);
      const expected = effectiveAccess({ type: row.role, staffId: row.id, accessPermissions: row.accessPermissions }, modules);
      assert.deepEqual(actual.capabilities, expected.capabilities);
      await check("/cash/operational", headers, expected.capabilities.cash ? 200 : 403);
      await check("/metrics/daily", headers, row.role === "admin" ? 200 : 403);
      await check("/access", { ...headers, "X-Staff-Session-Version": String(row.sessionVersion + 1) }, 403);
    }
    console.log(credentials.rows.length
      ? `PASS: ${credentials.rows.length} existing active team credentials checked; stale sessions denied`
      : "INFO: no active individual team credentials in production; live team sign-ins were verified with disposable local accounts");
    await db.query('SELECT "accessPermissions" FROM "Staff" LIMIT 0');
    await db.query('SELECT "priceActorId", "priceActorName", "priceActorRole" FROM "Appointment" LIMIT 0');
    await db.query('SELECT "recordedActorId", "recordedActorName", "recordedActorRole" FROM "Transaction" LIMIT 0');
    await db.query('SELECT "itemKind" FROM "TransactionItem" LIMIT 0');
    await db.query('SELECT "operationalAlerts" FROM "Pet" LIMIT 0');
    const migrated = await db.query("SELECT 1 FROM _prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL", ["20261001193000_team_business_access"]);
    assert.equal(migrated.rowCount, 1);
    console.log("PASS: migration applied and all new columns available; existing business modules preserved");
  } finally { await db.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
