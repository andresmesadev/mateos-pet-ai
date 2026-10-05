import type { Expense, ExpenseCategory } from "./expenses";

export type ExpenseHistoryRow = Expense & {
  responsible: string | null;
  status: "active" | "voided";
  voidReason: string | null;
  voidedAt: string | null;
};

export function isExpenseHistoryRow(value: unknown): value is ExpenseHistoryRow {
  if (!value || typeof value !== "object") return false;
  const row = value as ExpenseHistoryRow;
  return typeof row.id === "string" && !!row.id && typeof row.description === "string" &&
    (row.responsible === null || typeof row.responsible === "string") &&
    Number.isFinite(row.amount) && row.amount > 0 && Number.isFinite(Date.parse(row.date)) &&
    typeof row.category === "string" && typeof row.paymentMethod === "string" &&
    (row.notes === null || typeof row.notes === "string") && ["active", "voided"].includes(row.status) &&
    (row.voidReason === null || typeof row.voidReason === "string") &&
    (row.voidedAt === null || Number.isFinite(Date.parse(row.voidedAt)));
}

export function filterExpenses(rows: ExpenseHistoryRow[], query: string, category: ExpenseCategory | "all", status: "all" | "active" | "voided") {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return rows.filter(row => (category === "all" || row.category === category) && (status === "all" || row.status === status) &&
    terms.every(term => normalize([row.description, row.responsible, row.id].filter(Boolean).join(" ")).includes(term)));
}

export function expenseFormDirty(fields: { description: string; responsible: string; amount: string; notes: string; category: string; method: string }, defaultResponsible: string) {
  return fields.description !== "" || fields.amount !== "" || fields.notes !== "" ||
    fields.responsible !== defaultResponsible || fields.category !== "supplies" || fields.method !== "cash";
}
