/**
 * Respaldo de seguridad de la tabla Service ANTES de aplicar
 * 2.1-servicios-sistema-operativo.sql (que elimina la columna "category").
 * Ejecutar desde backend/: node scripts/migrations/backup-services-before-2.1.js
 */
require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM "Service"');
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(__dirname, "backups", `service-backup-${timestamp}.json`);
    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
    console.log(`Respaldo de ${rows.length} filas de Service guardado en: ${outPath}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Falló el respaldo:", err);
  process.exit(1);
});
