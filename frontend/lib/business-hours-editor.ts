import type { BusinessHourDay, BusinessHours, DayHours } from "@/app/dashboard/settings/page";

export const WEEK_DAYS: { key: BusinessHourDay; label: string }[] = [
  { key: "mon", label: "Lunes" }, { key: "tue", label: "Martes" }, { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" }, { key: "fri", label: "Viernes" }, { key: "sat", label: "Sábado" }, { key: "sun", label: "Domingo" },
];
export type WeekHours = Partial<Record<BusinessHourDay, DayHours>>;
export type HoursDraft = { general: WeekHours; services: Partial<Record<"vet" | "grooming", WeekHours>> };

export function readHoursDraft(source: BusinessHours | null | undefined): HoursDraft {
  const general: WeekHours = {};
  for (const { key } of WEEK_DAYS) if (source?.[key]) general[key] = { ...source[key] };
  const services: HoursDraft["services"] = {};
  for (const area of ["vet", "grooming"] as const) if (source?.services?.[area]) {
    services[area] = {};
    for (const { key } of WEEK_DAYS) if (source.services[area][key]) services[area][key] = { ...source.services[area][key] };
  }
  return { general, services };
}

// Display the current legacy fallback; never persist a fallback merely by opening the editor.
export function displayedDay(day: BusinessHourDay, source: WeekHours, fallback?: WeekHours): DayHours {
  return source[day] ?? fallback?.[day] ?? { open: "11:00", close: "17:00", active: day !== "sun" };
}

export function hoursPayload(draft: HoursDraft): BusinessHours {
  return { ...draft.general, ...(Object.keys(draft.services).length ? { services: draft.services } : {}) };
}

export function hoursSignature(draft: HoursDraft) {
  return JSON.stringify(readHoursDraft(hoursPayload(draft)));
}

export function hoursErrors(draft: HoursDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const sections = [["general", draft.general], ...Object.entries(draft.services)] as [string, WeekHours][];
  for (const [scope, days] of sections) for (const { key, label } of WEEK_DAYS) {
    const day = days[key];
    if (!day?.active) continue;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(day.open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.close)) errors[`${scope}-${key}`] = `${label}: completa la apertura y el cierre.`;
    else if (day.open >= day.close) errors[`${scope}-${key}`] = `${label}: el cierre debe ser posterior a la apertura.`;
  }
  return errors;
}

export function copyMondayToOpenDays(source: WeekHours, fallback?: WeekHours): WeekHours {
  const monday = displayedDay("mon", source, fallback);
  if (!monday.active) return source;
  const result = { ...source };
  for (const { key } of WEEK_DAYS) if (displayedDay(key, source, fallback).active) result[key] = { ...monday };
  return result;
}
