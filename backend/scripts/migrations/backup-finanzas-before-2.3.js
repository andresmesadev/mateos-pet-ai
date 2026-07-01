/**
 * Respaldo de seguridad de Expense y Transaction (+ TransactionItem) ANTES
 * de aplicar 2.3-finanzas-sistema-operativo.sql.
 * Ejecutar desde backend/: node scripts/migrations/backup-finanzas-before-2.3.js
 */
require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const expense = await client.query('SELECT * FROM "Expense"');
    const transaction = await client.query('SELECT * FROM "Transaction"');
    const transactionItem = await client.query('SELECT * FROM "TransactionItem"');

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = path.join(__dirname, "backups");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const paths = {
      expense: path.join(dir, `expense-backup-${timestamp}.json`),
      transaction: path.join(dir, `transaction-backup-${timestamp}.json`),
      transactionItem: path.join(dir, `transaction-item-backup-${timestamp}.json`),
    };

    fs.writeFileSync(paths.expense, JSON.stringify(expense.rows, null, 2));
    fs.writeFileSync(paths.transaction, JSON.stringify(transaction.rows, null, 2));
    fs.writeFileSync(paths.transactionItem, JSON.stringify(transactionItem.rows, null, 2));

    console.log(`Respaldo de ${expense.rows.length} filas de Expense guardado en: ${paths.expense}`);
    console.log(`Respaldo de ${transaction.rows.length} filas de Transaction guardado en: ${paths.transaction}`);
    console.log(`Respaldo de ${transactionItem.rows.length} filas de TransactionItem guardado en: ${paths.transactionItem}`);

    return paths;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Falló el respaldo:", err);
  process.exit(1);
});
