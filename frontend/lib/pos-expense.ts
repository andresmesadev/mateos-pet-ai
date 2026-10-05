import { moneyInCents } from "./pos-checkout";
import type { ExpenseCategory } from "./expenses";
import type { PaymentMethod } from "./transactions";

export type ExpenseCommand = { category: ExpenseCategory; description: string; responsible: string; amount: number; paymentMethod: PaymentMethod; notes: string | null; date: string };
export type ExpenseRecord = ExpenseCommand & { id: string; status: "active" | "voided"; createdAt: string; voidReason: string | null; voidedAt: string | null };
export type PendingExpense = { version: 1; scope: string; command: ExpenseCommand };

export function expenseAmountError(value: string): string | null {
  const cents = moneyInCents(value);
  return cents === null || cents <= 0 ? "Ingresa un monto mayor que cero, hasta 99.999.999,99, sin separadores de miles y con máximo dos decimales." : null;
}

export function isExpenseRecord(value: unknown): value is ExpenseRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as ExpenseRecord;
  return typeof row.id === "string" && !!row.id && typeof row.description === "string" && typeof row.responsible === "string" &&
    Number.isFinite(row.amount) && row.amount > 0 && ["active", "voided"].includes(row.status) &&
    ["supplies", "utilities", "rent", "salary", "equipment", "marketing", "other"].includes(row.category) &&
    ["cash", "transfer", "card", "other"].includes(row.paymentMethod) && Number.isFinite(Date.parse(row.date));
}

export function matchesExpense(row: ExpenseRecord, command: ExpenseCommand): boolean {
  return row.description === command.description && row.responsible === command.responsible &&
    Math.round(row.amount * 100) === Math.round(command.amount * 100) && row.category === command.category &&
    row.paymentMethod === command.paymentMethod && (row.notes || null) === command.notes && row.date === command.date;
}

export function pendingExpenseKey(scope: string): string { return `mateos-pos-expense-pending:${scope}`; }

export function readPendingExpense(raw: string, scope: string): PendingExpense | null {
  if (raw.length > 30_000) return null;
  try {
    const pending = JSON.parse(raw) as PendingExpense;
    const command = pending.command;
    if (pending.version !== 1 || pending.scope !== scope || !command || expenseAmountError(String(command.amount)) ||
      typeof command.description !== "string" || !command.description.trim() || typeof command.responsible !== "string" || !command.responsible.trim() ||
      (command.notes !== null && typeof command.notes !== "string") || !isExpenseRecord({ ...command, id: "pending", status: "active" })) return null;
    return pending;
  } catch { return null; }
}
