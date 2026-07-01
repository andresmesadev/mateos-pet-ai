require("dotenv").config();
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const expenseCols = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns WHERE table_name = 'Expense'
      ORDER BY ordinal_position
    `);
    console.log("Columnas de Expense:");
    console.table(expenseCols.rows);

    const txCols = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns WHERE table_name = 'Transaction'
      ORDER BY ordinal_position
    `);
    console.log("\nColumnas de Transaction:");
    console.table(txCols.rows);

    const originCheck = await client.query('SELECT origin, count(*) FROM "Transaction" GROUP BY origin');
    console.log("\nDistribución de origin en Transaction (debe ser 100% manual_pos_sale):");
    console.table(originCheck.rows);

    const statusCheck = await client.query('SELECT status, count(*) FROM "Expense" GROUP BY status');
    console.log("\nDistribución de status en Expense (debe ser 100% active):");
    console.table(statusCheck.rows);

    const indexes = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename IN ('Expense', 'Transaction', 'DailyClose', 'FinancialPeriod')
      ORDER BY tablename, indexname
    `);
    console.log("\nÍndices:");
    indexes.rows.forEach((r) => console.log(" -", r.tablename ?? "", r.indexname, "::", r.indexdef));

    const fkeys = await client.query(`
      SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid IN ('"DailyClose"'::regclass, '"FinancialPeriod"'::regclass) AND contype = 'f'
    `);
    console.log("\nClaves foráneas nuevas:");
    fkeys.rows.forEach((r) => console.log(" -", r.table_name, r.conname, "::", r.def));

    const tableCounts = await client.query(`
      SELECT 'Expense' AS t, count(*) FROM "Expense"
      UNION ALL SELECT 'Transaction', count(*) FROM "Transaction"
      UNION ALL SELECT 'DailyClose', count(*) FROM "DailyClose"
      UNION ALL SELECT 'FinancialPeriod', count(*) FROM "FinancialPeriod"
    `);
    console.log("\nConteo de filas:");
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
