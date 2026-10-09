import type { DashboardAccess } from "./dashboard-access";
export type ListFilters = Record<string, string>;
function text(raw: ListFilters, key: string, max = 80) { return typeof raw[key] === "string" ? raw[key].slice(0, max) : ""; }
function option(raw: ListFilters, key: string, allowed: readonly string[], fallback: string) { return allowed.includes(raw[key]) ? raw[key] : fallback; }
export function validListDate(value: string, fallback: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : fallback;
}
export function inventoryListFilters(raw: ListFilters, access: DashboardAccess | null): ListFilters {
  const c = access?.capabilities;
  const allowed = (access?.activeModules ?? []).filter(area => c?.inventory_manage || (area === "retail" ? c?.cash : area === "veterinary" ? c?.clinical : c?.grooming));
  return { q: text(raw, "q", 100), use: option(raw, "use", allowed, ""), status: option(raw, "status", ["low", "expiring", "expired"], ""), inactive: c?.inventory_manage && raw.inactive === "1" ? "1" : "0" };
}
const STAGES = ["Por recibir", "En espera", "En baño o corte", "Listas para entrega", "Entregadas", "Por revisar", "Canceladas / No asistieron"];
export function groomingListFilters(raw: ListFilters, today: string, staffIds: string[] | null): ListFilters {
  const q = text(raw, "q"), view = option(raw, "view", ["active", "history", "all"], q.trim().length >= 2 ? "all" : "active");
  const stage = raw.stage === "ready" ? "Listas para entrega" : option(raw, "stage", STAGES, "all");
  const archived = ["Entregadas", "Canceladas / No asistieron"].includes(stage);
  const allowedStage = stage === "all" || view === "all" || (view === "history" ? archived : !archived);
  return { q, date: validListDate(raw.date ?? "", today), view, stage: allowedStage ? stage : "all", staff: staffIds === null ? text(raw, "staff", 120) || "all" : option(raw, "staff", ["all", "unassigned", ...staffIds], "all") };
}
export function clinicalListFilters(raw: ListFilters, today: string, clinicianId: string | null, professionalIds: string[] | null): ListFilters {
  const defaultStaff = clinicianId || "all";
  const allowed = clinicianId ? ["all", "unassigned", clinicianId] : professionalIds === null ? null : ["all", "unassigned", ...professionalIds];
  return { q: text(raw, "q"), date: validListDate(raw.date ?? "", today), scope: option(raw, "scope", ["day", "week"], raw.date ? "week" : "day"), care: raw.care === "pending-record" ? "Historias pendientes" : option(raw, "care", ["Por revisar", "En atención", "Por atender", "Atendidas", "Historias pendientes"], "all"), staff: allowed === null ? text(raw, "staff", 120) || defaultStaff : option(raw, "staff", allowed, defaultStaff) };
}
