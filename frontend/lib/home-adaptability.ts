import type { TodayAppointment } from "./appointments";
import type { TeamRole } from "./dashboard-access";
import { validListDate, type ListFilters } from "./list-continuity";

export const DAY_GROUPS = [
  { key: "scheduled", label: "Por llegar", statuses: ["pending", "confirmed"] },
  { key: "waiting", label: "En espera", statuses: ["arrived"] },
  { key: "inProgress", label: "En atención", statuses: ["in_progress"] },
  { key: "completed", label: "Terminadas", statuses: ["completed"] },
] as const;
export type HomeScheduleFilter = "all" | "review" | typeof DAY_GROUPS[number]["key"];
export function matchesDayGroup(appointment: TodayAppointment, filter: HomeScheduleFilter) {
  const group = DAY_GROUPS.find(group => group.key === filter);
  return !group || (group.statuses as readonly string[]).includes(appointment.status);
}
export function agendaFirst(role: TeamRole) { return role !== "admin"; }
export function homeDayFilters(raw: ListFilters, hasAgenda: boolean): ListFilters {
  const allowed = ["all", "review", ...DAY_GROUPS.map(group => group.key)];
  return { dayFilter: hasAgenda && allowed.includes(raw.dayFilter) ? raw.dayFilter : "all" };
}
export function homePriorityFilters(raw: ListFilters, pages: number): ListFilters {
  const value = typeof raw.priorityPage === "string" && /^\d{1,4}$/.test(raw.priorityPage) ? Number(raw.priorityPage) : 1;
  return { priorityPage: String(Math.max(1, Math.min(value, Math.max(1, pages)))) };
}
export function followupTiming(dueAt: unknown, today: string) {
  const unavailable = { date: null, dateLabel: null, label: "Fecha no disponible", days: null };
  if (typeof dueAt !== "string" || !validListDate(today, "") || !validListDate(dueAt.slice(0, 10), "")) return unavailable;
  if (dueAt.length !== 10 && !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(dueAt)) return unavailable;
  const timestamp = Date.parse(dueAt);
  if (!Number.isFinite(timestamp)) return unavailable;
  const date = dueAt.length === 10 ? dueAt : new Date(timestamp).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const days = Math.round((Date.parse(today + "T12:00:00Z") - Date.parse(date + "T12:00:00Z")) / 86_400_000);
  const dateLabel = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" }).format(new Date(date + "T12:00:00Z"));
  return { date, dateLabel, days, label: days === 0 ? "Para hoy" : days > 0 ? `Pendiente hace ${days} ${days === 1 ? "día" : "días"}` : "Próximo seguimiento" };
}
export const HOME_STALE_MS = 2 * 60 * 1000;
export const HOME_REFRESH_COOLDOWN_MS = 30_000;
export function consultationAge(consultedAt: string | undefined, now: number) {
  const timestamp = consultedAt ? Date.parse(consultedAt) : NaN;
  return Number.isFinite(timestamp) ? Math.max(0, now - timestamp) : null;
}
export function ageLabel(consultedAt: string | undefined, now: number) {
  const age = consultationAge(consultedAt, now);
  if (age === null) return "";
  if (age < 60_000) return "hace menos de un minuto";
  const minutes = Math.floor(age / 60_000);
  return minutes === 1 ? "hace 1 minuto" : `hace ${minutes} minutos`;
}
export function homeDataIsStale(consultedAt: string | undefined, now: number) {
  const age = consultationAge(consultedAt, now);
  if (age === null || age >= HOME_STALE_MS) return true;
  const day = (time: number) => new Date(time).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return day(Date.parse(consultedAt!)) !== day(now);
}
