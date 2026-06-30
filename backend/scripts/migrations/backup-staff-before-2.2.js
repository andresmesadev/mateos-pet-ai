/**
 * Respaldo de seguridad de la tabla Staff ANTES de aplicar
 * 2.2-staff-sistema-operativo.sql (que agrega la columna "generatesCommission").
 * Ejecutar desde backend/: node scripts/migrations/backup-staff-before-2.2.js
 */
require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM "Staff"');
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(__dirname, "backups", `staff-backup-${timestamp}.json`);
    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
    console.log(`Respaldo de ${rows.length} filas de Staff guardado en: ${outPath}`);
    return outPath;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Falló el respaldo:", err);
  process.exit(1);
});
