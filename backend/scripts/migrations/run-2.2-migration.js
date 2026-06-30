/**
 * Ejecuta 2.2-staff-sistema-operativo.sql contra DATABASE_URL.
 * Ejecutar desde backend/: node scripts/migrations/run-2.2-migration.js
 */
require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, "2.2-staff-sistema-operativo.sql"),
    "utf8"
  );
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("Migración 2.2 aplicada correctamente.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Falló la migración (la transacción no debería haber dejado cambios a medias):", err);
  process.exit(1);
});
