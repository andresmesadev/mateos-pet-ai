"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CircleAlert, DollarSign, PawPrint, UserPlus } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { type DailyMetrics } from "@/components/dashboard/home/fetchers";
import { appointmentNeedsReview, type TodayAppointment } from "@/lib/appointments";
import { proxyUrl } from "@/lib/api";

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function DailyMetricsCards({ metrics: initialMetrics, appointments: initialAppointments, tenant }: { metrics: DailyMetrics | null; appointments: TodayAppointment[] | null; tenant?: string }) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [appointments, setAppointments] = useState(initialAppointments);

  useEffect(() => {
    let request = 0;
    const sync = (event: Event) => {
      const updated = (event as CustomEvent<TodayAppointment[]>).detail;
      if (Array.isArray(updated)) setAppointments(updated);
      const current = ++request;
      void fetch(proxyUrl("/api/dashboard/metrics/daily"), { cache: "no-store" })
        .then(async (response) => response.ok ? await response.json() as DailyMetrics : null)
        .then((next) => { if (current === request && next) setMetrics(next); })
        .catch(() => { /* Conservar el último dato válido si falla la red. */ });
    };
    window.addEventListener("dashboard:appointments-updated", sync);
    return () => { request++; window.removeEventListener("dashboard:appointments-updated", sync); };
  }, []);
  const activeAppointments = appointments?.filter((appointment) => !["cancelled", "no_show"].includes(appointment.status));
  const reviewCount = appointments?.filter(appointmentNeedsReview).length;
  const agendaHref = `/dashboard${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ""}#agenda-de-hoy`;
  const reviewHref = `/dashboard?review=1${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}#agenda-de-hoy`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href={agendaHref} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
          <MetricCard
            size="sm"
            icon={CalendarDays}
            tint="bg-teal-500/15 text-teal-700"
            label="Citas de hoy"
            value={activeAppointments === undefined ? "—" : String(activeAppointments.length)}
            delta={<span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">Ver agenda <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>}
          />
        </Link>
        <Link href={reviewHref} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
          <MetricCard
            size="sm"
            icon={CircleAlert}
            tint={reviewCount ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}
            label="Citas por revisar"
            value={reviewCount === undefined ? "—" : String(reviewCount)}
            delta={<span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">Ver pendientes <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>}
          />
        </Link>
        <Link href="/dashboard/calendar" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
          <MetricCard
            size="sm"
            icon={PawPrint}
            tint="bg-sky-500/15 text-sky-700"
            label="Mascotas atendidas"
            value={metrics ? String(metrics.petsAttendedToday.count) : "—"}
            delta={<span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">Ver calendario <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>}
          />
        </Link>
      </div>

      <section aria-labelledby="business-results-heading" className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="min-w-40 flex-1">
          <p className="text-xs font-semibold text-teal-700">Administración</p>
          <h3 id="business-results-heading" className="text-base font-bold text-slate-950">Resultado del negocio</h3>
        </div>
        <div className="flex min-w-40 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-800"><DollarSign className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <p className="text-xs text-slate-600">Cobrado hoy</p>
            <p className="text-lg font-bold tabular-nums text-slate-950">{metrics ? COP.format(metrics.revenueToday.count) : "—"}</p>
          </div>
        </div>
        <div className="flex min-w-40 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-800"><UserPlus className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <p className="text-xs text-slate-600">Clientes registrados hoy</p>
            <p className="text-lg font-bold tabular-nums text-slate-950">{metrics ? metrics.newClientsToday.count : "—"}</p>
          </div>
        </div>
        <Link href="/dashboard/pos?tab=historial" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
          Ver caja <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
