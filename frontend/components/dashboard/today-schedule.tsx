"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

function DaySummary({ appointments }: { appointments: TodayAppointment[] }) {
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
      {withPrice.length > 0 && (
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{COP.format(total)}</span>{" "}
          esperados
        </span>
      )}
      {withoutPrice.length > 0 && (
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
};

const POLL_INTERVAL_MS = 30_000;

export function TodaySchedule({ appointments: initial, initialReview = false }: Props) {
  const tenant = useTenant();
  const [appointments, setAppointments] = useState(initial);
  const [onlyNeedsAttention, setOnlyNeedsAttention] = useState(initialReview);
  const [selected, setSelected] = useState<TodayAppointment | null>(null);
  const [startInPriceEdit, setStartInPriceEdit] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [polling, setPolling] = useState(false);

  const header = formatTodayHeader();
  const capitalized = header.charAt(0).toUpperCase() + header.slice(1);
  const attentionCount = appointments.filter(appointmentNeedsReview).length;
  const visibleAppointments = onlyNeedsAttention ? appointments.filter(appointmentNeedsReview) : appointments;

  const refresh = useCallback(async (silent = true) => {
    if (!silent) setPolling(true);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/appointments/today"), {
        cache: "no-store",
      });
      if (res.ok) {
        const data: TodayAppointment[] = await res.json();
        setAppointments(data);
        setLastUpdated(new Date());
      }
    } catch { /* silently ignore network errors */ } finally {
      if (!silent) setPolling(false);
    }
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => refresh(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("dashboard:appointments-updated", { detail: appointments }));
  }, [appointments]);

  return (
    <>
      <Card id="agenda-de-hoy" className="scroll-mt-28 border-t-2 border-t-teal-500/50 border-black/[0.12]">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-3">
          <CardTitle className="text-base font-semibold">Agenda de hoy</CardTitle>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{capitalized}</span>
            <DailyCloseSheet />
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

        <CardContent>
          {appointments.length > 0 && <DaySummary appointments={appointments} />}
          {appointments.length > 0 && <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <button type="button" onClick={() => setOnlyNeedsAttention(false)} aria-pressed={!onlyNeedsAttention} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${!onlyNeedsAttention ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Todas las citas</button>
            <button type="button" onClick={() => setOnlyNeedsAttention(true)} aria-pressed={onlyNeedsAttention} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${onlyNeedsAttention ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Por revisar ({attentionCount})</button>
          </div>}
          {appointments.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 py-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">No hay citas para hoy</p>
                <p className="text-sm text-muted-foreground">Puedes agendar una cita manualmente.</p>
              </div>
              <Link href={`/dashboard/calendar?new=1${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`} className="inline-flex min-h-9 items-center rounded-lg border border-teal-200 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-700">Nueva cita</Link>
            </div>
          ) : visibleAppointments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">No hay citas que requieran revisión ahora.</p>
          ) : (
            <ul className="divide-y">
              {visibleAppointments.map((appt) => (
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
                        <span aria-hidden="true">·</span>
                        <span className={appt.finalPrice === null ? "font-medium text-amber-700" : "font-medium text-slate-800"}>{appt.finalPrice === null ? "Sin precio" : COP.format(appt.finalPrice)}</span>
                        {appt.finalPrice !== null && appt.priceResolution?.source && appt.priceResolution.source !== "manual_override" && <span className="text-slate-500">{PRICE_SOURCE_LABEL[appt.priceResolution.source]}</span>}
                      </span>
                    </span>
                  </button>
                  {appt.finalPrice === null && !["completed", "cancelled", "no_show"].includes(appt.status) && <button type="button" onClick={() => { setStartInPriceEdit(true); setSelected(appt); }} className="my-auto mr-2 shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-700 sm:mr-3">Definir precio</button>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selected && <AppointmentDetailDialog appointment={selected} startInPriceEdit={startInPriceEdit} onClose={() => { setSelected(null); setStartInPriceEdit(false); }} onUpdated={(updated) => {
        setSelected(updated);
        setAppointments((current) => current.map((appointment) => appointment.id === updated.id ? updated : appointment));
      }} />}
    </>
  );
}
