require("dotenv").config();
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const staff = await client.query('SELECT id, name, "generatesCommission", availability FROM "Staff" ORDER BY name');
    console.log("Staff (con generatesCommission):", staff.rows.map(r => ({ name: r.name, generatesCommission: r.generatesCommission, hadAvailability: r.availability != null })));

    const availability = await client.query('SELECT "staffId", type, weekday, "startTime", "endTime" FROM "StaffAvailability" ORDER BY "staffId", weekday');
    console.log("\nStaffAvailability backfilleada:", availability.rows.length, "filas");
    console.table(availability.rows);

    const nullCheck = await client.query('SELECT count(*) FROM "Staff" WHERE "generatesCommission" IS NULL');
    console.log("\nStaff con generatesCommission NULL (debe ser 0):", nullCheck.rows[0].count);

    const indexes = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename IN ('Staff', 'StaffAvailability', 'StaffCapability', 'Settlement')
      ORDER BY tablename, indexname
    `);
    console.log("\nÍndices creados:");
    indexes.rows.forEach((r) => console.log(" -", r.indexname, "::", r.indexdef));

    const checks = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid = '"StaffAvailability"'::regclass AND contype = 'c'
    `);
    console.log("\nCHECK constraints en StaffAvailability:");
    checks.rows.forEach((r) => console.log(" -", r.conname, "::", r.pg_get_constraintdef));

    const tableCounts = await client.query(`
      SELECT 'StaffAvailability' AS t, count(*) FROM "StaffAvailability"
      UNION ALL SELECT 'StaffCapability', count(*) FROM "StaffCapability"
      UNION ALL SELECT 'Settlement', count(*) FROM "Settlement"
    `);
    console.log("\nConteo de filas en tablas nuevas:");
    console.table(tableCounts.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
