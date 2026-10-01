import type { TimelineItem } from "@/lib/pets";
import type { ClientAppointment } from "@/lib/clients";

export function formatPetAge(birthDate: string | null | undefined, now = new Date()): string {
  if (!birthDate) return "Sin fecha de nacimiento";
  const birthKey = birthDate.slice(0, 10);
  const todayKey = now.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const birth = new Date(`${birthKey}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthKey) || Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthKey || birthKey > todayKey) return "Revisar fecha de nacimiento";
  const [by, bm, bd] = birthKey.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const months = (ty - by) * 12 + tm - bm - (td < bd ? 1 : 0);
  if (months < 1) return "Menos de 1 mes";
  const years = Math.floor(months / 12), rest = months % 12;
  return [years ? `${years} ${years === 1 ? "año" : "años"}` : "", rest ? `${rest} ${rest === 1 ? "mes" : "meses"}` : ""].filter(Boolean).join(" y ");
}

export const HISTORY_FILTERS = [
  { id: "all", label: "Todo" }, { id: "consultation", label: "Consultas" }, { id: "vaccine", label: "Vacunas" },
  { id: "deworming", label: "Desparasitación" }, { id: "grooming", label: "Peluquería" }, { id: "allergy", label: "Alergias" }, { id: "note", label: "Notas y otros" },
] as const;
export type HistoryFilter = typeof HISTORY_FILTERS[number]["id"];
export function isGroomingTimelineItem(item: TimelineItem): boolean {
  return item.kind === "grooming" || (["cancelled", "no_show"].includes(item.kind) && ["grooming", "bath_grooming", "bath"].includes(item.serviceType ?? ""));
}
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function matchesHistory(item: TimelineItem, filter: HistoryFilter, query: string): boolean {
  const known = ["consultation", "vaccine", "deworming", "grooming", "allergy"];
  const kind = isGroomingTimelineItem(item) ? "grooming" : item.kind;
  if (filter !== "all" && (filter === "note" ? known.includes(kind) : kind !== filter)) return false;
  const text = normalized([item.title, item.detail, item.staffName, item.serviceName, item.reason, item.findings, item.diagnosis, item.treatment, item.recommendations, item.date].filter(Boolean).join(" "));
  return normalized(query).trim().split(/\s+/).every((word) => text.includes(word));
}

export function groupClientAppointments(appointments: ClientAppointment[], now = Date.now()) {
  const upcoming: ClientAppointment[] = [], pending: ClientAppointment[] = [], previous: ClientAppointment[] = [];
  for (const item of appointments) {
    if (["completed", "cancelled", "no_show"].includes(item.status)) previous.push(item);
    else if (["arrived", "in_progress"].includes(item.status) || new Date(item.date).getTime() < now) pending.push(item);
    else upcoming.push(item);
  }
  upcoming.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  pending.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  previous.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { upcoming, pending, previous };
}
