// Read-only smoke check. Run through stdin in the production backend container.
const { Client } = require("pg");

(async () => {
  const headers = {
    "X-Internal-Token": process.env.INTERNAL_API_SECRET,
    "X-Tenant-Id": process.env.SINGLE_TENANT_ID,
  };
  for (const path of ["/api/dashboard/tenant/profile", "/api/dashboard/appointments/week", "/api/dashboard/staff", "/api/dashboard/grooming/appointments"]) {
    const response = await fetch(`http://127.0.0.1:3000${path}`, { headers });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    await response.json();
    console.log(`${path}: HTTP 200, JSON válido`);
  }
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const result = await db.query("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 2");
    console.log(`Migraciones: ${result.rows.map((row) => row.migration_name).join(", ")}`);
    await db.query('SELECT version FROM "MedicalRecord" LIMIT 0');
    await db.query('SELECT id FROM "MedicalRecordRevision" LIMIT 0');
    await db.query('SELECT "staffId" FROM "StaffCredential" LIMIT 0');
    await db.query('SELECT "groomingNotes", "groomingNotesVersion", "groomingDeliveredAt" FROM "Appointment" LIMIT 0');
    console.log("Esquema clínico, identidad y peluquería: correcto");
  } finally {
    await db.end();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
