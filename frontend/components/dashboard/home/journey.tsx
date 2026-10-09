"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useListContinuity } from "@/lib/use-list-continuity";
import type { DashboardAccess } from "@/lib/dashboard-access";
import type { TodayAppointment } from "@/lib/appointments";
import { dayCounts, homeHref } from "@/lib/home-workspace";
import { agendaFirst, DAY_GROUPS, homeDayFilters, type HomeScheduleFilter } from "@/lib/home-adaptability";
import { TodaySchedule } from "../today-schedule";

export function HomeJourney({ appointments: initial, access, tenant, initialReview, attention }: {
  appointments: TodayAppointment[] | null; access: DashboardAccess; tenant?: string;
  initialReview: boolean; attention: ReactNode;
}) {
  const [appointments, setAppointments] = useState(initial);
  const params = useSearchParams();
  const continuity = useListContinuity("home-agenda", { dayFilter: initialReview ? "review" : "all" }, raw => homeDayFilters(raw, access.capabilities.agenda), params.has("review") ? { dayFilter: params.getAll("review").length === 1 && params.get("review") === "1" ? "review" : "all" } : undefined);
  const filter = continuity.filters.dayFilter as HomeScheduleFilter;
  const setFilter = (next: HomeScheduleFilter) => continuity.update({ dayFilter: next });
  const agenda = useRef<HTMLDivElement>(null);
  const [agendaHeight, setAgendaHeight] = useState<number>();
  useEffect(() => {
    const node = agenda.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setAgendaHeight(Math.ceil(node.getBoundingClientRect().height)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [access.capabilities.agenda]);
  useEffect(() => {
    // Keep the last successful agenda explicitly labelled if a later read fails.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial !== null) setAppointments(initial);
  }, [initial]);
  const counts = appointments ? dayCounts(appointments) : null;
  const stale = initial === null;
  function choose(next: HomeScheduleFilter) {
    setFilter(next);
    agenda.current?.scrollIntoView({ behavior: "instant", block: "start" });
    agenda.current?.focus({ preventScroll: true });
  }
  const schedule = access.capabilities.agenda ? <div ref={agenda} id="home-day-agenda" tabIndex={-1} data-home-section="agenda" className="min-w-0 scroll-mt-28 rounded-2xl focus-visible:outline-2 focus-visible:outline-teal-700">
    {stale && <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{appointments ? "No se pudo actualizar la jornada. Se muestran las últimas citas cargadas; confirma los datos antes de actuar." : "No se pudo comprobar la jornada. Las cifras y las citas no están disponibles."}</p>}
    {appointments ? <TodaySchedule appointments={appointments} initialReview={initialReview} compact access={access} filter={filter} onFilterChange={setFilter} onAppointmentsChange={setAppointments} /> : <section className="rounded-2xl border bg-white p-6"><h2 className="font-bold">Agenda no disponible</h2><Link prefetch={false} href={homeHref("/dashboard/calendar", tenant)} className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary underline">Abrir agenda</Link></section>}
  </div> : null;
  const priorities = <div data-home-section="attention" className="min-w-0">{attention}</div>;
  return <div className="@container space-y-6">
    {access.capabilities.agenda && <section aria-label="Resumen de la jornada" className="overflow-hidden rounded-2xl border bg-white">
      <div className="grid grid-cols-2 sm:grid-cols-4">{DAY_GROUPS.map(group => <button key={group.key} type="button" disabled={stale} aria-pressed={filter === group.key} aria-controls="home-day-agenda" aria-label={`${group.label}: ${counts?.[group.key] ?? "no disponible"} citas`} onClick={() => choose(group.key)} className={`min-h-24 border-b border-r border-border px-4 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:border-b-0 ${filter === group.key ? "bg-teal-50 text-teal-900 ring-2 ring-inset ring-teal-600" : "hover:bg-slate-50"}`}>
        <span className="block text-sm">{group.label}</span><span className="mt-2 block text-2xl font-bold tabular-nums">{counts?.[group.key] ?? "—"}</span>
      </button>)}</div>
      <p className="px-4 py-3 text-xs text-muted-foreground">{stale ? "Resumen no actualizado. Usa Actualizar Inicio para comprobar la jornada." : "Selecciona un estado para ver sus citas en la agenda."}</p>
    </section>}
    <div style={agendaHeight ? { "--home-agenda-height": `${agendaHeight}px` } as CSSProperties : undefined} className={`grid items-start gap-6 ${schedule ? agendaFirst(access.role) ? "@min-[880px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" : "@min-[880px]:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]" : ""}`}>
      {agendaFirst(access.role) ? <>{schedule}{priorities}</> : <>{priorities}{schedule}</>}
    </div>
  </div>;
}
