export type ReportPeriod = "week" | "month" | "year";
export type ReportComparison = "full" | "equivalent";
export type MetricPoint = { value: number; prev: number; delta: number; pct: number | null };
export type ReportMetadata = { period: ReportPeriod; offset: number; comparison: ReportComparison; comparisonClamped: boolean; rangeStart: string; rangeEnd: string; previousRangeStart: string; previousRangeEnd: string; asOf: string; partial: boolean; year: number };
export type ReportSummary = ReportMetadata & { establishment: { id: string; name: string }; revenue: MetricPoint; expenses: MetricPoint; difference: MetricPoint; appointments: MetricPoint; newClients: MetricPoint; petsAttended: MetricPoint; transactionCount: number };
export type ServiceReport = { name: string; count: number };
export type RevenueMonth = { month: number; revenue: number; year: number };
export type ActivityMonth = { label: string; newClients: number; returningVisits: number };
export const METHOD_LABELS = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro", review: "Por revisar", unclassified: "Sin identificar" };
export const KIND_LABELS = { product: "Productos", service: "Servicios", unclassified: "Sin clasificación" };
export type ReportBreakdown = ReportMetadata & { total: number; count: number; byMethod: { method: keyof typeof METHOD_LABELS; count: number; total: number }[]; byKind: { kind: keyof typeof KIND_LABELS; quantity: number; lines: number; total: number }[]; unallocatedTotal: number };
export const REPORT_MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Respuesta incompleta");
  return value as Record<string, unknown>;
};
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const count = (value: unknown) => number(value) && Number.isSafeInteger(value) && value >= 0;
const amount = (value: unknown) => number(value) && value >= 0;
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const fail = () => { throw new Error("Respuesta incompleta"); };
function metadata(value: unknown): ReportMetadata {
  const row = object(value);
  if (typeof row.period !== "string" || !["week", "month", "year"].includes(row.period) || !number(row.offset) || !Number.isSafeInteger(row.offset) || row.offset > 0 || !count(row.year) || typeof row.partial !== "boolean") fail();
  if (typeof row.comparison !== "string" || !["full", "equivalent"].includes(row.comparison) || typeof row.comparisonClamped !== "boolean") fail();
  for (const key of ["rangeStart", "rangeEnd", "previousRangeStart", "previousRangeEnd", "asOf"]) if (!date(row[key])) fail();
  if (Date.parse(String(row.rangeStart)) >= Date.parse(String(row.rangeEnd)) || Date.parse(String(row.previousRangeStart)) >= Date.parse(String(row.previousRangeEnd))) fail();
  return row as ReportMetadata;
}
function metric(value: unknown, signed = false): MetricPoint {
  const row = object(value);
  if (!(signed ? number(row.value) && number(row.prev) : amount(row.value) && amount(row.prev)) || !number(row.delta) || !(row.pct === null || number(row.pct))) fail();
  return row as MetricPoint;
}
export function parseReportSummary(value: unknown): ReportSummary {
  const row = object(value); const meta = metadata(row);
  for (const key of ["revenue", "expenses", "appointments", "newClients", "petsAttended"]) metric(row[key]);
  metric(row.difference, true);
  if (!count(row.transactionCount)) fail();
  const establishment = object(row.establishment);
  if (typeof establishment.id !== "string" || !establishment.id || typeof establishment.name !== "string" || !establishment.name.trim()) fail();
  return { ...row, ...meta } as ReportSummary;
}
export function parseServices(value: unknown): ServiceReport[] {
  if (!Array.isArray(value) || !value.every(entry => { const row = object(entry); return typeof row.name === "string" && row.name.length > 0 && count(row.count); })) fail();
  return value as ServiceReport[];
}
export function parseRevenueMonths(value: unknown): RevenueMonth[] {
  if (!Array.isArray(value) || value.length !== 12 || !value.every((entry, index) => { const row = object(entry); return row.month === index + 1 && amount(row.revenue) && count(row.year) && row.year === value[0].year; })) fail();
  return value as RevenueMonth[];
}
export function parseActivity(value: unknown): ActivityMonth[] {
  if (!Array.isArray(value) || value.length !== 6 || !value.every(entry => { const row = object(entry); return typeof row.label === "string" && count(row.newClients) && count(row.returningVisits); })) fail();
  return value as ActivityMonth[];
}
export function parseBreakdown(value: unknown): ReportBreakdown {
  const row = object(value); metadata(row);
  if (!amount(row.total) || !count(row.count) || !number(row.unallocatedTotal)) fail();
  const methods = row.byMethod; const kinds = row.byKind;
  if (!Array.isArray(methods) || !Array.isArray(kinds)) return fail();
  if (methods.length !== 6 || new Set(methods.map(entry => entry.method)).size !== 6 || !methods.every(entry => Object.hasOwn(METHOD_LABELS, object(entry).method as string) && amount(entry.total) && count(entry.count))) fail();
  if (kinds.length !== 3 || new Set(kinds.map(entry => entry.kind)).size !== 3 || !kinds.every(entry => Object.hasOwn(KIND_LABELS, object(entry).kind as string) && amount(entry.total) && count(entry.quantity) && count(entry.lines))) fail();
  const cents = (n: number) => Math.round(n * 100);
  if (methods.reduce((sum, entry) => sum + cents(entry.total), 0) !== cents(row.total as number) || methods.reduce((sum, entry) => sum + entry.count, 0) !== row.count || kinds.reduce((sum, entry) => sum + cents(entry.total), 0) + cents(row.unallocatedTotal as number) !== cents(row.total as number)) fail();
  return row as ReportBreakdown;
}
export function reportMoney(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value);
}
export function reportDate(value: string) {
  return new Date(value).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" });
}
export function reportRange(start: string, end: string) {
  return `${reportDate(start)} – ${reportDate(new Date(Date.parse(end) - 1).toISOString())}`;
}
export function reportBarHeight(value: number, maximum: number) {
  return maximum > 0 && value > 0 ? Math.max(2, Math.round(value / maximum * 150)) : 0;
}

export function reportComparisonText(data: ReportMetadata) {
  if (data.comparison === "equivalent") return `Se comparan los mismos días del calendario${data.partial ? " hasta hoy" : ""}.${data.comparisonClamped ? " El período anterior es más corto: se utiliza su último día disponible." : ""}`;
  return data.partial ? "El período actual está en curso; se compara lo registrado hasta ahora con el período anterior completo." : "La comparación corresponde al período anterior completo.";
}
export function reportDateKey(value: string) {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
export function reportsAgree(summary?: ReportSummary, breakdown?: ReportBreakdown) {
  if (!summary || !breakdown) return false;
  const keys = ["period", "offset", "comparison", "rangeStart", "rangeEnd", "previousRangeStart", "previousRangeEnd"] as const;
  return keys.every(key => summary[key] === breakdown[key]) && Math.round(summary.revenue.value * 100) === Math.round(breakdown.total * 100) && summary.transactionCount === breakdown.count;
}
export type ReportSelection = { period: ReportPeriod; offset: number; comparison: ReportComparison };
export function readReportSelection(params: { period?: unknown; offset?: unknown; comparison?: unknown }): ReportSelection {
  const period = typeof params.period === "string" && ["week", "month", "year"].includes(params.period) ? params.period as ReportPeriod : "month";
  const offset = typeof params.offset === "string" && /^-?\d+$/.test(params.offset) && Number(params.offset) >= -1200 && Number(params.offset) <= 0 ? Number(params.offset) : 0;
  const comparison = params.comparison === "equivalent" ? "equivalent" : "full";
  return { period, offset, comparison };
}
export type ReportDetail = { from: string; to: string; kind: "income" | "expense" | "review"; selection: ReportSelection };
export function readReportDetail(params: Record<string, unknown>): ReportDetail | undefined {
  if (params.source !== "reports" || typeof params.detail !== "string" || !["income", "expense", "review"].includes(params.detail)) return;
  const { from, to } = params;
  const civil = (value: unknown): value is string => typeof value === "string" && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!civil(from) || !civil(to) || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 365) return;
  return { from, to, kind: params.detail as ReportDetail["kind"], selection: readReportSelection({ period: params.reportPeriod, offset: params.reportOffset, comparison: params.comparison }) };
}
export function reportReturnUrl(selection: ReportSelection, tenant?: string | null) {
  const params = new URLSearchParams({ tab: "reportes", period: selection.period, offset: String(selection.offset), comparison: selection.comparison });
  if (tenant) params.set("tenant", tenant);
  return `/dashboard/pos?${params}`;
}
export function reportDetailUrl(data: ReportMetadata, kind: ReportDetail["kind"], tenant?: string | null) {
  const params = new URLSearchParams({ tab: kind === "expense" ? "egreso" : "historial", source: "reports", detail: kind, from: reportDateKey(data.rangeStart), to: reportDateKey(new Date(Date.parse(data.rangeEnd) - 1).toISOString()), reportPeriod: data.period, reportOffset: String(data.offset), comparison: data.comparison });
  if (tenant) params.set("tenant", tenant);
  return `/dashboard/pos?${params}`;
}
