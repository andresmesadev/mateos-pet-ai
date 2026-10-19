export type CommissionPeriod = "day" | "week" | "fortnight" | "month";
export type CloseStaff = { staffId: string | null; count: number; staffShare: number; businessShare: number };
export type CloseDay = { date: string; closed: boolean; incomeTotal: number; expenseTotal: number; netAmount: number; staffCommissionTotal: number; netAfterCommissions: number; staffBreakdown: CloseStaff[] };

export function commissionPeriod(date: string, period: CommissionPeriod) {
  const day = new Date(date + "T12:00:00Z");
  if (period === "week") day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  if (period === "fortnight") day.setUTCDate(day.getUTCDate() <= 15 ? 1 : 16);
  if (period === "month") day.setUTCDate(1);
  return { from: day.toISOString().slice(0, 10), to: date };
}

export function aggregateCommissions(days: CloseDay[]) {
  const staff = new Map<string, CloseStaff>();
  for (const day of days) for (const row of day.staffBreakdown) {
    const key = row.staffId ?? "unassigned";
    const previous = staff.get(key) ?? { ...row, count: 0, staffShare: 0, businessShare: 0 };
    staff.set(key, { ...previous, count: previous.count + row.count,
      staffShare: (Math.round(previous.staffShare * 100) + Math.round(Number(row.staffShare) * 100)) / 100,
      businessShare: (Math.round(previous.businessShare * 100) + Math.round(Number(row.businessShare) * 100)) / 100 });
  }
  return [...staff.values()];
}
