require("dotenv").config();
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const categories = await client.query('SELECT * FROM "ServiceCategory" ORDER BY name');
    console.log("ServiceCategory:", categories.rows);

    const services = await client.query(
      'SELECT id, name, "categoryId", "tenantId" FROM "Service" ORDER BY name'
    );
    console.log("\nService (con categoryId):", services.rows);

    const orphan = await client.query('SELECT count(*) FROM "Service" WHERE "categoryId" IS NULL');
    console.log("\nServicios sin categoryId (debe ser 0):", orphan.rows[0].count);

    const indexes = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename IN ('Service', 'ServiceCategory', 'PriceRule')
      ORDER BY tablename, indexname
    `);
    console.log("\nÍndices creados:");
    indexes.rows.forEach((r) => console.log(" -", r.indexname, "::", r.indexdef));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
