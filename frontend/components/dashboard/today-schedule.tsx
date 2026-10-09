"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DashboardAccess } from "@/lib/dashboard-access";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { homeAppointments, homeHref } from "@/lib/home-workspace";
import { DAY_GROUPS, matchesDayGroup, type HomeScheduleFilter } from "@/lib/home-adaptability";
import { ChevronRight } from "lucide-react";
import { DailyCloseSheet } from "@/components/dashboard/daily-close-sheet";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentDetailDialog } from "@/components/dashboard/appointment-detail-dialog";
import {
  type TodayAppointment,
  appointmentNeedsReview,
  formatColombiaTime,
  formatService,
  formatStatus,
  statusBadgeClass,
} from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";
import { proxyUrl } from "@/lib/api";
import { useTenant } from "@/lib/use-tenant";

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const PRICE_SOURCE_LABEL: Record<string, string> = {
  manual_override:   "Override",
  pet_agreed_price: "Tarifa de mascota",
  pet_default_price: "Mascota",
  service_base_price:"Catálogo",
};

function DaySummary({ appointments, prices }: { appointments: TodayAppointment[]; prices: boolean }) {
  const active = appointments.filter(
    (a) => a.status !== "cancelled" && a.status !== "no_show"
  );
  const withPrice = active.filter((a) => a.finalPrice !== null);
  const withoutPrice = active.filter((a) => a.finalPrice === null);
  const total = withPrice.reduce((sum, a) => sum + (a.finalPrice ?? 0), 0);

  return (
    <div className="flex flex-wrap gap-3 px-1 py-2 mb-1 text-sm">
      <span className="text-muted-foreground">
        <span className="font-semibold text-foreground">{active.length}</span>{" "}
        {active.length === 1 ? "cita" : "citas"}
      </span>
      {prices && withPrice.length > 0 && (
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{COP.format(total)}</span>{" "}
          esperados
        </span>
      )}
      {prices && withoutPrice.length > 0 && (
        <span className="flex items-center gap-1 text-amber-500 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {withoutPrice.length} sin precio
        </span>
      )}
    </div>
  );
}

function formatTimeSince(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 10) return "justo ahora";
  if (secs < 60) return `hace ${secs}s`;
  return `hace ${Math.floor(secs / 60)}min`;
}

function formatTodayHeader(): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

type Props = {
  appointments: TodayAppointment[];
  initialReview?: boolean;
  compact?: boolean;
  access?: DashboardAccess;
  filter?: HomeScheduleFilter;
  onFilterChange?: (filter: HomeScheduleFilter) => void;
  onAppointmentsChange?: (appointments: TodayAppointment[]) => void;
};

const POLL_INTERVAL_MS = 30_000;

export function TodaySchedule({ appointments: initial, initialReview = false, compact = false, access: providedAccess, filter, onFilterChange, onAppointmentsChange }: Props) {
  const contextAccess = useDashboardAccess();
  const access = providedAccess ?? contextAccess;
  const prices = !!(access?.capabilities.cash || access?.capabilities.appointmentPrice);
  const router = useRouter();
  const tenant = useTenant();
  const [appointments, setAppointments] = useState(initial);
  const [onlyNeedsAttention, setOnlyNeedsAttention] = useState(initialReview);
  const [selected, setSelected] = useState<TodayAppointment | null>(null);
  const [startInPriceEdit, setStartInPriceEdit] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [polling, setPolling] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  useEffect(() => {
    // Synchronize the server refresh without remounting an open appointment dialog.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppointments(initial);
  }, [initial]);

  const header = formatTodayHeader();
  const capitalized = header.charAt(0).toUpperCase() + header.slice(1);
  const needsAttention = (appointment: TodayAppointment) => prices ? appointmentNeedsReview(appointment) :
    ["pending", "confirmed", "arrived", "in_progress"].includes(appointment.status) && (["arrived", "in_progress"].includes(appointment.status) || !appointment.staffName);
  const attentionCount = appointments.filter(needsAttention).length;
  const selectedFilter = filter ?? (onlyNeedsAttention ? "review" : "all");
  const groupLabel = DAY_GROUPS.find(group => group.key === selectedFilter)?.label;
  const visibleAppointments = appointments.filter(appointment => selectedFilter === "review" ? needsAttention(appointment) : matchesDayGroup(appointment, selectedFilter));
  useEffect(() => { onAppointmentsChange?.(appointments); }, [appointments, onAppointmentsChange]);
  function changeFilter(next: HomeScheduleFilter) { if (onFilterChange) onFilterChange(next); else setOnlyNeedsAttention(next === "review"); }

  const refresh = useCallback(async (silent = true) => {
    if (!silent) setPolling(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/appointments/today${tenant ? `?tenantId=${encodeURIComponent(tenant)}` : ""}`), {
        cache: "no-store",
      });
      if (res.ok) {
        const data: TodayAppointment[] = await res.json();
        setAppointments(access ? homeAppointments(data, access) : data);
        setLastUpdated(new Date());
        setRefreshError(false);
        if (compact) router.refresh();
      } else setRefreshError(true);
    } catch { setRefreshError(true); } finally {
      if (!silent) setPolling(false);
    }
  }, [tenant, compact, router, access]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (compact) return;
    const id = setInterval(() => refresh(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh, compact]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("dashboard:appointments-updated", { detail: appointments }));
  }, [appointments]);

  return (
    <>
      <Card id="agenda-de-hoy" className={`scroll-mt-28 border-t-2 border-t-teal-500/50 border-black/[0.12] ${compact ? "@min-[880px]:min-h-[430px]" : ""}`}>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-3">
          <CardTitle className="text-base font-semibold"><h2>Agenda de hoy</h2></CardTitle>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{capitalized}</span>
            {access?.capabilities.finance && !compact && <DailyCloseSheet />}
            <button
              onClick={() => refresh(false)}
              disabled={polling}
              aria-label="Actualizar ahora"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-3.5 h-3.5 ${polling ? "animate-spin" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H5.498a.75.75 0 0 0-.75.75v3.232a.75.75 0 0 0 1.5 0v-1.54l.308.31a7 7 0 0 0 11.494-3.353.75.75 0 1 0-1.454-.364zm-4.306-9.85a.75.75 0 0 0-.75.75v3.232a.75.75 0 0 0 1.5 0v-1.54l.308.31a7 7 0 0 0-11.494 3.353.75.75 0 0 0 1.454.364 5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5h3.232a.75.75 0 0 0 .75-.75V2.324a.75.75 0 0 0-.75-.75z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden sm:inline">
                {polling ? "Actualizando…" : `${formatTimeSince(lastUpdated)}`}
              </span>
            </button>
          </div>
        </CardHeader>

        <CardContent className={compact ? "flex min-h-0 flex-1 flex-col" : undefined}>
          {refreshError && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">No se pudo actualizar. Se muestran los últimos datos cargados.</p>}
          {appointments.length > 0 && !compact && <DaySummary appointments={appointments} prices={prices} />}
          {appointments.length > 0 && <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <button type="button" onClick={() => changeFilter("all")} aria-pressed={selectedFilter === "all"} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${selectedFilter === "all" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Todas las citas</button>
            <button type="button" onClick={() => changeFilter("review")} aria-pressed={selectedFilter === "review"} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${selectedFilter === "review" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Por revisar ({attentionCount})</button>
          </div>}
          {groupLabel && <p role="status" className="mb-3 text-sm font-semibold text-teal-800">Mostrando: {groupLabel.toLocaleLowerCase("es-CO")}</p>}
          {appointments.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 py-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">No hay citas para hoy</p>
                <p className="text-sm text-muted-foreground">{access?.capabilities.schedule ? "Puedes agendar una cita manualmente." : "Las citas de tu área aparecerán aquí."}</p>
              </div>
              {access?.capabilities.schedule && <Link prefetch={false} href={homeHref("/dashboard/calendar?new=1", tenant)} className="inline-flex min-h-9 items-center rounded-lg border border-teal-200 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-700">Nueva cita</Link>}
            </div>
          ) : visibleAppointments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">{groupLabel ? `No hay citas en «${groupLabel}» ahora.` : "No hay citas que requieran revisión ahora."}</p>
          ) : (
            <ul className="divide-y" aria-label="Citas de la agenda">
              {(compact ? visibleAppointments.slice(0, 8) : visibleAppointments).map((appt) => (
                <li key={appt.id} className="flex items-stretch rounded-xl transition-colors hover:bg-slate-50 focus-within:bg-slate-50">
                  <button type="button" onClick={() => { setStartInPriceEdit(false); setSelected(appt); }} aria-label={`Abrir cita de ${appt.petName}, ${formatColombiaTime(appt.date)}`} className="grid min-w-0 flex-1 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-teal-700 sm:px-3">
                    <span className="whitespace-nowrap text-sm font-bold tabular-nums text-slate-950">{formatColombiaTime(appt.date)}</span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-950">{getPetEmoji(appt.petType)} {appt.petName}</span>
                        <span className="truncate text-sm text-slate-600">{appt.clientName ?? appt.clientPhone}</span>
                        <Badge variant="outline" className={`ml-auto shrink-0 ${statusBadgeClass(appt.status)}`}>{formatStatus(appt.status)}</Badge>
                        <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" aria-hidden="true" />
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                        <span>{appt.serviceName ?? formatService(appt.serviceType)}</span>
                        <span aria-hidden="true">·</span>
                        <span className={!appt.staffName && !["cancelled", "no_show"].includes(appt.status) ? "font-medium text-amber-700" : ""}>{appt.staffName ?? "Sin asignar"}</span>
                        {prices && <><span aria-hidden="true">·</span><span className={appt.finalPrice === null ? "font-medium text-amber-700" : "font-medium text-slate-800"}>{appt.finalPrice === null ? "Sin precio" : COP.format(appt.finalPrice)}</span></>}
                        {prices && appt.finalPrice !== null && appt.priceResolution?.source && appt.priceResolution.source !== "manual_override" && <span className="text-slate-500">{PRICE_SOURCE_LABEL[appt.priceResolution.source]}</span>}
                      </span>
                    </span>
                  </button>
                  {access?.capabilities.appointmentPrice && appt.finalPrice === null && !["completed", "cancelled", "no_show"].includes(appt.status) && <button type="button" onClick={() => { setStartInPriceEdit(true); setSelected(appt); }} className="my-auto mr-2 shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-700 sm:mr-3">Definir precio</button>}
                </li>
              ))}
            </ul>
          )}
          {compact && <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm"><p className="text-xs text-muted-foreground">{visibleAppointments.length > 8 ? `8 de ${visibleAppointments.length} citas en este filtro` : `${visibleAppointments.length} citas en este filtro`}</p><Link prefetch={false} href={homeHref("/dashboard/calendar", tenant)} className="inline-flex min-h-10 items-center font-semibold text-primary underline underline-offset-4">Abrir agenda completa</Link></div>}
        </CardContent>
      </Card>

      {selected && <AppointmentDetailDialog appointment={selected} startInPriceEdit={startInPriceEdit} onClose={() => { setSelected(null); setStartInPriceEdit(false); }} onUpdated={(updated) => {
        setSelected(updated);
        setAppointments((current) => current.map((appointment) => appointment.id === updated.id ? updated : appointment));
        if (compact) router.refresh();
      }} />}
    </>
  );
}
