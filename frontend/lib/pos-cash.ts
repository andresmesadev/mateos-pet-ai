import type { PaymentMethod, Transaction } from "./transactions";

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
