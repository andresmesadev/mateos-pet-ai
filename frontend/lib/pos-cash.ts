import type { PaymentMethod, Transaction } from "./transactions";
import { isHistoryPage, type HistoryPage } from "./financial-history-page";
import { isHistoryTransaction, transactionNeedsReview } from "./pos-history";

export type CashData = HistoryPage<Transaction> & { date: string; scope: "day" | "pending"; transactions: Transaction[]; toReview: string[]; totalRegistered: number; hasMore: boolean; pendingCount: number; summaryCash: ReturnType<typeof summarizeCash> };
export function isCashData(value: unknown): value is CashData {
  if (!isHistoryPage(value, isHistoryTransaction)) return false;
  const cash = value as CashData;
  const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
  const summary = cash.summaryCash;
  return /^\d{4}-\d{2}-\d{2}$/.test(cash.date) && ["day", "pending"].includes(cash.scope) && integer(cash.pendingCount) &&
    Array.isArray(cash.toReview) && cash.toReview.length === cash.data.filter(transactionNeedsReview).length && cash.data.every(row => cash.toReview.includes(row.id) === transactionNeedsReview(row)) &&
    Number.isFinite(cash.totalRegistered) && cash.totalRegistered === cash.summary.activeTotal && typeof cash.hasMore === "boolean" && cash.hasMore === (cash.page < cash.totalPages) &&
    !!summary && integer(summary.reviewCount) && integer(summary.reviewCents) &&
    ["cash", "transfer", "card", "other"].every(method => { const group = summary.methods?.[method as PaymentMethod]; return !!group && integer(group.count) && integer(group.cents); }) &&
    summary.reviewCount + Object.values(summary.methods).reduce((sum, group) => sum + group.count, 0) === cash.total &&
    summary.reviewCents + Object.values(summary.methods).reduce((sum, group) => sum + group.cents, 0) === Math.round(cash.totalRegistered * 100);
}

export type CashFilter = "all" | "review" | "registered";
export type CashMethod = PaymentMethod | "all";

export function summarizeCash(rows: Transaction[], reviewIds: Set<string>) {
  const methods: Record<PaymentMethod, { count: number; cents: number }> = {
    cash: { count: 0, cents: 0 }, transfer: { count: 0, cents: 0 },
    card: { count: 0, cents: 0 }, other: { count: 0, cents: 0 },
  };
  let reviewCents = 0, reviewCount = 0;
  for (const row of rows) {
    const cents = Math.round(row.total * 100);
    if (reviewIds.has(row.id)) { reviewCents += cents; reviewCount++; }
    else {
      const method = methods[row.paymentMethod] ?? methods.other;
      method.count++; method.cents += cents;
    }
  }
  return { methods, reviewCents, reviewCount };
}

export function filterCash(rows: Transaction[], reviewIds: Set<string>, query: string, filter: CashFilter, method: CashMethod) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return rows.filter(row => {
    const reviewing = reviewIds.has(row.id);
    if (filter === "review" && !reviewing || filter === "registered" && reviewing) return false;
    // An unreviewed system charge has a stored default, not a confirmed method.
    if (method !== "all" && (reviewing || row.paymentMethod !== method)) return false;
    const text = normalize([row.clientName, row.clientPhone, row.petName, row.id, row.recordedBy?.name, ...row.items.map(item => item.description)].filter(Boolean).join(" "));
    return terms.every(term => text.includes(term));
  });
}
