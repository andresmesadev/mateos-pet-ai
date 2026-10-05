// Read-only production check. Run through stdin from /app in the backend.
// --baseline only reads persisted counts and does not require the new release.
const assert = require('node:assert/strict');
const { Client } = require('pg');

(async () => {
  const tenantId = process.env.SINGLE_TENANT_ID;
  assert.ok(tenantId, 'A concrete establishment is required');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const tenant = await db.query('SELECT active FROM "Tenant" WHERE id=$1', [tenantId]);
    assert.equal(tenant.rows.length, 1);
    assert.equal(tenant.rows[0].active, true);
    const counts = {};
    for (const table of ['User', 'Pet', 'Appointment', 'Transaction', 'PetNextAction', 'InventoryProduct', 'InventoryMovement']) {
      const result = await db.query(`SELECT COUNT(*)::int AS total FROM "${table}" WHERE "tenantId"=$1`, [tenantId]);
      counts[table] = result.rows[0].total;
    }
    const records = await db.query('SELECT COUNT(*)::int AS total FROM "MedicalRecord" r JOIN "Pet" p ON p.id=r."petId" WHERE p."tenantId"=$1', [tenantId]);
    counts.MedicalRecord = records.rows[0].total;
    console.log('Persisted counts: ' + JSON.stringify(counts));
    if (process.argv.includes('--baseline')) return;

    const headers = { 'X-Internal-Token': process.env.INTERNAL_API_SECRET, 'X-Tenant-Id': tenantId };
    const get = async (path, status = 200) => {
      const response = await fetch('http://127.0.0.1:3000/api/dashboard' + path, { headers });
      assert.equal(response.status, status, path);
      const data = await response.json();
      console.log(path + ': HTTP ' + status);
      return data;
    };
    const pending = await get('/opportunities?page=1');
    const entries = Object.values(pending.byType).flat();
    for (const entry of entries) {
      const pet = await db.query('SELECT name, "ownerId", "tenantId" FROM "Pet" WHERE id=$1', [entry.petId]);
      assert.equal(pet.rows[0].tenantId, tenantId);
      assert.equal(pet.rows[0].name, entry.petName);
      assert.equal(pet.rows[0].ownerId, entry.ownerId);
      if (entry.source === 'action') {
        const source = await db.query('SELECT status, "dueAt", "tenantId" FROM "PetNextAction" WHERE id=$1', [entry.actionId]);
        assert.equal(source.rows[0].status, 'pending');
        assert.equal(source.rows[0].tenantId, tenantId);
        assert.equal(source.rows[0].dueAt.toISOString(), entry.dueAt);
      } else {
        const source = await db.query('SELECT "nextControlAt", "reminderSent" FROM "MedicalRecord" WHERE id=$1', [entry.actionId]);
        assert.equal(source.rows[0].reminderSent, false);
        assert.equal(source.rows[0].nextControlAt.toISOString(), entry.dueAt);
      }
    }
    for (const period of ['past', 'today', 'next7']) {
      const result = await get('/opportunities?page=1&period=' + period);
      assert.equal(result.total, pending.periodCounts[period]);
    }
    console.log('Pending rows match expedientes: ' + entries.length + '; total=' + pending.total);

    const inactive = await get('/clients/inactive?page=1');
    const raw = await db.query(`SELECT COUNT(*)::int AS total FROM (
      SELECT u.id FROM "User" u JOIN "Pet" p ON p."ownerId"=u.id AND p."tenantId"=u."tenantId"
      JOIN "MedicalRecord" r ON r."petId"=p.id AND r.type='grooming'
      WHERE u."tenantId"=$1 GROUP BY u.id
      HAVING MAX(r.date)<$2 OR MAX(r.date) IS NULL) eligible`, [tenantId, new Date(Date.now() - 60 * 86400000)]);
    assert.equal(inactive.total, raw.rows[0].total);
    for (const entry of inactive.data) {
      const owner = await db.query('SELECT "lastReminderSentAt", "tenantId" FROM "User" WHERE id=$1', [entry.id]);
      assert.equal(owner.rows[0].tenantId, tenantId);
      assert.equal(owner.rows[0].lastReminderSentAt?.toISOString() ?? null, entry.lastReminderSentAt);
      const last = await db.query('SELECT MAX(r.date) AS date FROM "MedicalRecord" r JOIN "Pet" p ON p.id=r."petId" WHERE p."ownerId"=$1 AND p."tenantId"=$2 AND r.type=$3', [entry.id, tenantId, 'grooming']);
      assert.equal(last.rows[0].date?.toISOString() ?? null, entry.lastVisitDate);
    }
    const never = await get('/clients/inactive?page=1&contact=never');
    const recorded = await get('/clients/inactive?page=1&contact=recorded');
    assert.equal(never.total + recorded.total, inactive.total);
    await get('/clients/inactive?page=1&contact=recorded&contactFrom=2026-10-06&contactTo=2026-10-05', 400);
    const context = await get('/campaigns/reactivation/context');
    console.log('Inactive/contact data match PostgreSQL: total=' + inactive.total + '; never=' + never.total + '; recorded=' + recorded.total);
    console.log('WhatsApp readiness: ' + JSON.stringify({ ready: context.ready, channelConfigured: context.channelConfigured, templateConfigured: context.templateConfigured }));
    console.log('Read-only release check passed; no messages or records changed.');
  } finally { await db.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
