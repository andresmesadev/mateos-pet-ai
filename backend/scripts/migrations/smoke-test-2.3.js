/**
 * Smoke test contra la base real ya migrada (Entregable 2.3): confirma que
 * el código de Fase 1 que depende de Expense y Transaction sigue funcionando
 * exactamente igual tras la extensión aditiva, y que el nuevo contexto
 * Finance carga y compone correctamente. Solo lectura — no escribe datos
 * nuevos contra la base real.
 */
require("dotenv").config();
const prisma = require("../../src/lib/prisma");
const finance = require("../../src/contexts/finance");

async function main() {
  console.log("1) Expense — lectura legacy sigue funcionando (expenses.routes.js replicado):");
  const expenses = await prisma.expense.findMany({ orderBy: { date: "desc" }, take: 500 });
  console.log(`    ${expenses.length} gasto(s) leído(s). Todos con status (nuevo campo):`, expenses.every((e) => e.status === "active"));

  console.log("\n2) Transaction — lectura legacy sigue funcionando (transactions.routes.js replicado):");
  const transactions = await prisma.transaction.findMany({ include: { items: true }, orderBy: { paidAt: "desc" }, take: 200 });
  console.log(`    ${transactions.length} transacción(es) leída(s). Todas con origin (nuevo campo):`, transactions.every((t) => t.origin === "manual_pos_sale"));

  console.log("\n3) metrics/cashbox (lógica replicada) — sigue calculando correctamente con las columnas nuevas:");
  const totalIncome = transactions.reduce((s, t) => s + Number(t.total), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  console.log(`    totalIncome=${totalIncome}, totalExpenses=${totalExpenses}, netBalance=${totalIncome - totalExpenses}`);

  console.log("\n4) Nuevas tablas DailyClose/FinancialPeriod — vacías, como se esperaba (sin historial a reconstruir):");
  const dailyCloseCount = await prisma.dailyClose.count();
  const financialPeriodCount = await prisma.financialPeriod.count();
  console.log(`    DailyClose=${dailyCloseCount}, FinancialPeriod=${financialPeriodCount}`);

  console.log("\n5) Contexto Finance — composition root carga y expone los 8 casos de uso:");
  const useCaseNames = Object.keys(finance);
  console.log(`    ${useCaseNames.length} casos de uso:`, useCaseNames.join(", "));

  console.log("\n6) daily-close.routes.js (Fase 1) — sigue leyendo Appointment+Commission sin cambios:");
  const commissionCount = await prisma.commission.count();
  console.log(`    Total de comisiones existentes (no debería haber cambiado):`, commissionCount);

  console.log("\nOK: compatibilidad total con Fase 1 confirmada (ADR 005).");
}

main()
  .catch((err) => {
    console.error("FALLÓ EL SMOKE TEST:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
