export type HistoryPage<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: { activeCount: number; voidedCount: number; activeTotal: number };
};

export function isHistoryPage<T>(value: unknown, isRow: (row: unknown) => row is T): value is HistoryPage<T> {
  if (!value || typeof value !== "object") return false;
  const result = value as HistoryPage<T>;
  const integer = (n: number, minimum: number) => Number.isSafeInteger(n) && n >= minimum;
  if (!integer(result.total, 0) || !integer(result.page, 1) || !integer(result.pageSize, 1) || result.pageSize > 50 ||
    !integer(result.totalPages, 1) || result.totalPages !== Math.max(1, Math.ceil(result.total / result.pageSize)) || result.page > result.totalPages ||
    !Array.isArray(result.data) || result.data.length !== Math.min(result.pageSize, Math.max(0, result.total - (result.page - 1) * result.pageSize)) || !result.data.every(isRow)) return false;
  const summary = result.summary;
  return !!summary && integer(summary.activeCount, 0) && integer(summary.voidedCount, 0) && summary.activeCount + summary.voidedCount === result.total &&
    Number.isFinite(summary.activeTotal) && summary.activeTotal >= 0;
}
