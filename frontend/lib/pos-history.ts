import type { PaymentMethod, Transaction } from "./transactions";

export function validHistoryRange(from: string, to: string) {
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  return valid(from) && valid(to) && from <= to;
}
export type HistoryOrigin = "all" | "manual_pos_sale" | "system_appointment_completed" | "legacy";
export const HISTORY_ORIGIN_LABELS = { manual_pos_sale: "Venta manual", system_appointment_completed: "Cobro de cita", legacy: "Registro anterior" };
export type HistoryQuickPeriod = "today" | "yesterday" | "week" | "month";

export function transactionNeedsReview(row: Transaction) {
  return row.paymentStatus === "pending" || (row.origin === "system_appointment_completed" && !row.recordedBy?.id);
}

export function historyQuickRange(today: string, period: HistoryQuickPeriod) {
  const offset = (days: number) => new Date(Date.parse(today + "T12:00:00Z") + days * 86_400_000).toISOString().slice(0, 10);
  if (period === "yesterday") return { from: offset(-1), to: offset(-1) };
  return { from: period === "week" ? offset(-6) : period === "month" ? today.slice(0, 7) + "-01" : today, to: today };
}

export function initialHistoryRange(period: string, today: string) {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period) || period > today.slice(0, 7)) return historyQuickRange(today, "month");
  const last = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0)).toISOString().slice(0, 10);
  return { from: `${period}-01`, to: period === today.slice(0, 7) ? today : last };
}

export function filterTransactions(rows: Transaction[], query: string, method: PaymentMethod | "all" | "review", status: "all" | "active" | "voided", origin: HistoryOrigin = "all") {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return rows.filter(row => (method === "all" || (method === "review" ? transactionNeedsReview(row) : !transactionNeedsReview(row) && (row.paymentMethod === method || (row.paymentMethod === 'mixed' && ['cash', 'transfer'].includes(method))))) &&
    (status === "all" || (row.status ?? "active") === status) &&
    (origin === "all" || (row.origin ?? "legacy") === origin) &&
    terms.every(term => normalize([row.id, row.clientName, row.clientPhone, row.petName, row.recordedBy?.name, ...row.items.map(item => item.description)].filter(Boolean).join(" ")).includes(term)));
}
export function canVoidSale(transaction: Transaction, isAdmin: boolean) {
  return isAdmin && transaction.origin === "manual_pos_sale" && transaction.status === "active";
}

export function summarizeHistory(rows: Transaction[]) {
  let active = 0, voided = 0, activeCents = 0;
  for (const row of rows) {
    if (row.status === "voided") voided++;
    else { active++; activeCents += Math.round(row.total * 100); }
  }
  return { active, voided, activeTotal: activeCents / 100 };
}

export function inventoryReturnProgress(row: Transaction) {
  const products = row.items.filter(item => item.productId);
  return { pending: row.status === "voided" ? products.filter(item => !item.inventoryReturn) : [], received: products.filter(item => item.inventoryReturn) };
}

export function isHistoryTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== "object") return false;
  const row = value as Transaction;
  return typeof row.id === "string" && !!row.id && Number.isFinite(row.total) && row.total >= 0 &&
    ((row.paidAt === null && row.paymentStatus === "pending" && row.origin === "system_appointment_completed") || (typeof row.paidAt === "string" && Number.isFinite(Date.parse(row.paidAt)) && row.paymentStatus !== "pending")) && [undefined, "active", "voided"].includes(row.status) &&
    [undefined, "manual_pos_sale", "system_appointment_completed", "legacy"].includes(row.origin) &&
    ["cash", "transfer", "card", "other", "mixed"].includes(row.paymentMethod) &&
    (row.paymentMethod !== 'mixed' || (typeof row.cashAmount === 'number' && typeof row.transferAmount === 'number' && Number.isFinite(row.cashAmount) && Number.isFinite(row.transferAmount) && row.cashAmount > 0 && row.transferAmount > 0 && Math.round(row.cashAmount * 100) + Math.round(row.transferAmount * 100) === Math.round(row.total * 100))) &&
    [row.clientName, row.clientPhone, row.petName, row.notes, row.voidReason].every(field => field == null || typeof field === "string") &&
    (row.voidedAt == null || (typeof row.voidedAt === "string" && Number.isFinite(Date.parse(row.voidedAt)))) &&
    (row.recordedBy == null || (typeof row.recordedBy.id === "string" && (row.recordedBy.name == null || typeof row.recordedBy.name === "string"))) &&
    Array.isArray(row.items) && row.items.every(item => item && typeof item.id === "string" && typeof item.description === "string" && Number.isInteger(item.quantity) && item.quantity > 0 && Number.isFinite(item.unitPrice) && item.unitPrice >= 0 && Number.isFinite(item.total) && item.total >= 0 &&
      (item.inventoryReturn == null || (typeof item.inventoryReturn.id === "string" && ["restock", "discard"].includes(item.inventoryReturn.disposition) && Number.isInteger(item.inventoryReturn.quantity) && item.inventoryReturn.quantity > 0)));
}
