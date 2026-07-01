/**
 * Única regla de consolidación del contexto Finanzas. La usan tanto
 * GenerateDailyCloseUseCase (hecho oficial) como GetFinancialHistoryUseCase
 * (vista preliminar de un día no cerrado) — mismo algoritmo, distinto estado
 * de los datos que recibe. Ver sistema-operativo-finanzas.md, sección 3.
 */

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {{ charges: Array<{total:any}>, expenses: Array<{amount:any}>, commissions: Array<{staffId:?string, staffShare:any, businessShare:any}> }} data
 */
function summarizeDay({ charges, expenses, commissions }) {
  const incomeTotal = charges.reduce((sum, c) => sum + Number(c.total), 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netAmount = incomeTotal - expenseTotal;

  const byStaff = new Map();
  for (const commission of commissions) {
    const key = commission.staffId ?? "__unassigned__";
    if (!byStaff.has(key)) {
      byStaff.set(key, { staffId: commission.staffId ?? null, count: 0, staffShare: 0, businessShare: 0 });
    }
    const entry = byStaff.get(key);
    entry.count += 1;
    entry.staffShare += Number(commission.staffShare);
    entry.businessShare += Number(commission.businessShare);
  }

  return {
    incomeTotal: round2(incomeTotal),
    expenseTotal: round2(expenseTotal),
    netAmount: round2(netAmount),
    staffBreakdown: Array.from(byStaff.values()).map((entry) => ({
      ...entry,
      staffShare: round2(entry.staffShare),
      businessShare: round2(entry.businessShare),
    })),
  };
}

/**
 * @param {Array<{date: Date, incomeTotal:any, expenseTotal:any, netAmount:any}>} dailyCloses
 */
function summarizePeriod(dailyCloses) {
  const incomeTotal = dailyCloses.reduce((sum, d) => sum + Number(d.incomeTotal), 0);
  const expenseTotal = dailyCloses.reduce((sum, d) => sum + Number(d.expenseTotal), 0);
  const netAmount = incomeTotal - expenseTotal;

  return {
    incomeTotal: round2(incomeTotal),
    expenseTotal: round2(expenseTotal),
    netAmount: round2(netAmount),
    breakdown: dailyCloses.map((d) => ({
      date: d.date,
      incomeTotal: Number(d.incomeTotal),
      expenseTotal: Number(d.expenseTotal),
      netAmount: Number(d.netAmount),
    })),
  };
}

module.exports = { summarizeDay, summarizePeriod };
