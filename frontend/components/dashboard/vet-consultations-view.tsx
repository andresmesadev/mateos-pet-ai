"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Clock3, Search, Stethoscope, X } from "lucide-react";

import { VetRecordSheet } from "@/components/dashboard/vet-record-sheet";
import { proxyUrl } from "@/lib/api";
import { arrivalWindowExpired, type TodayAppointment, formatStatus, statusBadgeClass } from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";

type Props = {
  appointments: TodayAppointment[];
  preview?: boolean;
  tenantId?: string;
  clinician?: boolean;
  clinicianStaffId?: string | null;
};

const VET_SERVICE_TYPES = new Set(["vet", "consultation", "veterinary_consultation"]);

function isVetAppointment(appointment: TodayAppointment): boolean {
  if (appointment.serviceCategory) return appointment.serviceCategory === "veterinary";
  const serviceType = appointment.serviceType.toLowerCase();
  return VET_SERVICE_TYPES.has(serviceType);
}

function bogotaDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekStart(date: string): string {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return shiftDays(date, day === 0 ? -6 : 1 - day);
}

function weekLabel(date: string): string {
  const start = weekStart(date);
  const end = shiftDays(start, 6);
  const format = (value: string) => new Intl.DateTimeFormat("es-CO", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
  return `${format(start)} – ${format(end)}`;
}

function careGroup(appointment: TodayAppointment, today: string): "Por revisar" | "En atención" | "Por atender" | "Atendidas" {
  if (bogotaDate(appointment.date) < today && !["completed", "cancelled", "no_show"].includes(appointment.status)) return "Por revisar";
  if (appointment.status === "in_progress") return "En atención";
  if (appointment.status === "completed") return "Atendidas";
  return "Por atender";
}

const GROUPS = ["Por revisar", "En atención", "Por atender", "Atendidas"] as const;

function appointmentDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function appointmentTime(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function VetConsultationsView({ appointments, preview = false, tenantId, clinician = false, clinicianStaffId = null }: Props) {
  const isVet = clinician;
  const [scope, setScope] = useState<"today" | "week">("today");
  const [professionalFilter, setProfessionalFilter] = useState(clinician && clinicianStaffId ? clinicianStaffId : "all");
  const [careFilter, setCareFilter] = useState("all");
  const [professionals, setProfessionals] = useState<{ id: string; name: string }[]>([]);
  const [professionalError, setProfessionalError] = useState(false);
  const [selected, setSelected] = useState<TodayAppointment | null>(null);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [anchor, setAnchor] = useState(today);
  const [weekAppointments, setWeekAppointments] = useState(appointments);
  const [loading, setLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [failedDate, setFailedDate] = useState<string | null>(null);
  const requestId = useRef(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TodayAppointment[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestId = useRef(0);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    void fetch(proxyUrl(`/api/dashboard/staff${query}`), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("staff");
        const data = await response.json() as { id: string; name: string; role: string }[];
        if (!Array.isArray(data)) throw new Error("staff");
        if (!cancelled) setProfessionals(data.filter((item) => item.role === "vet"));
      })
      .catch(() => { if (!cancelled) setProfessionalError(true); });
    return () => { cancelled = true; };
  }, [preview, tenantId]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (preview || searchQuery.trim().length >= 2) return;
    const timer = setInterval(() => {
      const params = new URLSearchParams({ date: anchor });
      if (tenantId) params.set("tenantId", tenantId);
      void fetch(proxyUrl(`/api/dashboard/appointments/week?${params}`), { cache: "no-store" })
        .then(async (response) => response.ok ? response.json() as Promise<{ appointments?: TodayAppointment[] }> : null)
        .then((payload) => { if (Array.isArray(payload?.appointments)) setWeekAppointments(payload.appointments); })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, [anchor, preview, searchQuery, tenantId]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchRequestId.current += 1;
  }, []);

  async function runSearch(query: string, currentRequest: number) {
    try {
      if (preview) {
        const term = query.toLocaleLowerCase("es-CO");
        const matches = appointments.filter((item) =>
          `${item.petName} ${item.clientName ?? ""}`.toLocaleLowerCase("es-CO").includes(term)
        );
        if (currentRequest === searchRequestId.current) setSearchResults(matches);
        return;
      }
      const params = new URLSearchParams({ q: query });
      if (tenantId) params.set("tenantId", tenantId);
      const response = await fetch(proxyUrl(`/api/dashboard/appointments/consultations/search?${params}`), { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { appointments?: TodayAppointment[]; hasMore?: boolean; error?: string };
      if (!response.ok || !Array.isArray(payload.appointments)) {
        throw new Error(payload.error ?? "No se pudieron buscar las consultas.");
      }
      if (currentRequest !== searchRequestId.current) return;
      setSearchResults(payload.appointments);
      setSearchHasMore(Boolean(payload.hasMore));
    } catch (error) {
      if (currentRequest === searchRequestId.current) {
        setSearchError(error instanceof Error ? error.message : "No se pudieron buscar las consultas.");
      }
    } finally {
      if (currentRequest === searchRequestId.current) setSearchLoading(false);
    }
  }

  function updateSearch(value: string) {
    setSearchQuery(value);
    setSearchResults(null);
    setSearchError(null);
    setSearchHasMore(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const currentRequest = ++searchRequestId.current;
    const query = value.trim();
    if (query.length < 2) {
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => void runSearch(query, currentRequest), 300);
  }

  function clearSearch() {
    updateSearch("");
  }

  async function advanceAppointment(appointment: TodayAppointment, next: "arrived" | "in_progress" | "completed") {
    if (preview) return;
    if (next === "completed") {
      if (!appointment.hasMedicalRecord) {
        setStatusError(`Guarda primero la historia clínica de ${appointment.petName}.`);
        return;
      }
      if (!window.confirm("¿Finalizar esta cita? Además de cerrar la atención, se registrarán el cobro y la comisión correspondientes.")) return;
    }
    setStatusBusyId(appointment.id);
    setStatusError(null);
    try {
      const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      const complete = next === "completed";
      const response = await fetch(proxyUrl(`/api/dashboard/appointments/${appointment.id}${complete ? "/complete" : ""}${query}`), {
        method: complete ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complete ? {} : { status: next }),
      });
      const payload = await response.json().catch(() => ({})) as TodayAppointment & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Intenta de nuevo.");
      const updated = { ...payload, hasMedicalRecord: appointment.hasMedicalRecord };
      setWeekAppointments((current) => current.map((item) => item.id === appointment.id ? updated : item));
      setSearchResults((current) => current?.map((item) => item.id === appointment.id ? updated : item) ?? null);
    } catch (cause) {
      setStatusError(`No se pudo avanzar la cita de ${appointment.petName}. ${cause instanceof Error ? cause.message : "Intenta de nuevo."}`);
    } finally {
      setStatusBusyId(null);
    }
  }

  async function loadWeek(date: string, nextScope: "today" | "week" = "week") {
    if (preview || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setWeekError(null);
    setFailedDate(null);
    try {
      const query = new URLSearchParams({ date });
      if (tenantId) query.set("tenantId", tenantId);
      const response = await fetch(proxyUrl(`/api/dashboard/appointments/week?${query}`), { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron cargar las consultas de esa semana.");
      const payload = await response.json() as { appointments?: TodayAppointment[] };
      if (!Array.isArray(payload.appointments)) throw new Error("La respuesta de la agenda no es válida.");
      if (currentRequest !== requestId.current) return;
      setWeekAppointments(payload.appointments);
      setAnchor(date);
      setScope(nextScope);
    } catch (error) {
      if (currentRequest === requestId.current) {
        setWeekError(error instanceof Error ? error.message : "No se pudieron cargar las consultas.");
        setFailedDate(date);
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  const veterinaryAppointments = weekAppointments
    .filter(isVetAppointment)
    .filter((appointment) => appointment.status !== "cancelled" && appointment.status !== "no_show");
  const searchActive = searchQuery.trim().length >= 2;
  const periodAppointments = searchActive ? (searchResults ?? []) : scope === "today"
    ? veterinaryAppointments.filter((appointment) => bogotaDate(appointment.date) === today)
    : veterinaryAppointments;
  const professionalAppointments = periodAppointments.filter((item) => professionalFilter === "all" || (professionalFilter === "unassigned" ? !item.staffId : item.staffId === professionalFilter));
  const visible = professionalAppointments.filter((item) => careFilter === "all" || (careFilter === "Historias pendientes" ? ["in_progress", "completed"].includes(item.status) && !item.hasMedicalRecord : careGroup(item, today) === careFilter));
  const period = searchActive ? "en resultados" : scope === "today" ? "hoy" : "semana seleccionada";

  const metrics = [
    { label: "Por revisar", value: professionalAppointments.filter((item) => careGroup(item, today) === "Por revisar").length, icon: Clock3, tint: "bg-amber-50 text-amber-700" },
    { label: "Por atender", value: professionalAppointments.filter((item) => careGroup(item, today) === "Por atender").length, icon: CalendarDays, tint: "bg-sky-50 text-sky-700" },
    { label: "En atención", value: professionalAppointments.filter((item) => careGroup(item, today) === "En atención").length, icon: Stethoscope, tint: "bg-amber-50 text-amber-700" },
    { label: "Atendidas", value: professionalAppointments.filter((item) => careGroup(item, today) === "Atendidas").length, icon: ClipboardList, tint: "bg-teal-50 text-teal-700" },
    { label: "Historias pendientes", value: professionalAppointments.filter((item) => ["in_progress", "completed"].includes(item.status) && !item.hasMedicalRecord).length, icon: ClipboardList, tint: "bg-rose-50 text-rose-700" },
  ];

  return (
    <div className="space-y-6">
      {(!searchActive || searchResults) && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label={`Resumen de consultas: ${period}`}>
        {metrics.map(({ label, value, icon: Icon, tint }) => (
          <button type="button" key={label} onClick={() => setCareFilter((current) => current === label ? "all" : label)} aria-pressed={careFilter === label} className={`flex items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${careFilter === label ? "border-teal-600 ring-1 ring-teal-600" : "border-border"}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label} · {period}</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
            </div>
          </button>
        ))}
      </div>}

      <section aria-labelledby="consultas-lista" className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 id="consultas-lista" className="text-lg font-bold text-foreground">Citas veterinarias</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Consulta la atención del día o busca por mascota y propietario en todas las fechas.</p>
          </div>
          <div aria-label="Período de consultas" className="inline-flex rounded-lg border border-border p-1">
            <button type="button" onClick={() => { clearSearch(); if (weekStart(anchor) === weekStart(today)) setScope("today"); else void loadWeek(today, "today"); }} aria-pressed={!searchActive && scope === "today"} className={`min-h-9 rounded-md px-4 text-sm font-semibold transition-colors ${!searchActive && scope === "today" ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Hoy</button>
            <button type="button" onClick={() => { clearSearch(); setScope("week"); }} aria-pressed={!searchActive && scope === "week"} className={`min-h-9 rounded-md px-4 text-sm font-semibold transition-colors ${!searchActive && scope === "week" ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Semana</button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="w-full max-w-md space-y-1.5">
            <label htmlFor="buscar-consulta" className="text-sm font-semibold text-foreground">Buscar por mascota o propietario</label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input id="buscar-consulta" type="search" value={searchQuery} onChange={(event) => updateSearch(event.target.value)} maxLength={80} placeholder="Ej. Luna o Camila Torres" className="min-h-10 w-full rounded-xl border border-border bg-white py-2 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-600" />
              {searchQuery && <button type="button" onClick={clearSearch} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button>}
            </div>
          </div>
          <p className="pb-2 text-xs text-muted-foreground">{searchActive ? "Buscando en todas las fechas" : searchQuery ? "Escribe al menos 2 caracteres" : "La búsqueda incluye consultas anteriores"}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2" aria-label="Asignación de consultas">
            {[...(clinicianStaffId ? [{ value: clinicianStaffId, label: "Mis consultas" }] : []), { value: "unassigned", label: "Sin asignar" }, { value: "all", label: "Todas" }].map((option) => <button key={option.value} type="button" aria-pressed={professionalFilter === option.value} onClick={() => setProfessionalFilter(option.value)} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${professionalFilter === option.value ? "bg-teal-700 text-white" : "border border-border hover:bg-muted"}`}>{option.label}</button>)}
          </div>
          {!clinician && <div className="flex items-center gap-2"><label htmlFor="consultas-profesional" className="text-sm text-muted-foreground">Profesional:</label><select id="consultas-profesional" value={professionalFilter} onChange={(event) => setProfessionalFilter(event.target.value)} className="min-h-9 max-w-64 rounded-lg border border-border bg-white px-3 text-sm"><option value="all">Todos los profesionales</option><option value="unassigned">Sin asignar</option>{professionals.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>}
          {professionalError && !clinician && <p role="status" className="text-xs text-amber-800">No se cargó el listado de profesionales. Puedes usar Todas o Sin asignar.</p>}
          {careFilter !== "all" && <button type="button" onClick={() => setCareFilter("all")} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-800">{careFilter}<X className="size-4" aria-hidden="true" /><span className="sr-only">Quitar filtro</span></button>}
        </div>

        {!preview && !searchActive && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-slate-50/70 px-5 py-3 text-sm sm:px-6">
            <button type="button" onClick={() => void loadWeek(shiftDays(anchor, -7))} disabled={loading} aria-label="Semana anterior" className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-50"><ChevronLeft className="size-4" /></button>
            <span className="min-w-48 text-center font-semibold text-foreground">{scope === "today" ? "Hoy" : weekLabel(anchor)}</span>
            <button type="button" onClick={() => void loadWeek(shiftDays(anchor, 7))} disabled={loading} aria-label="Semana siguiente" className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-50"><ChevronRight className="size-4" /></button>
            <label htmlFor="consultas-fecha" className="ml-1 text-muted-foreground">Buscar semana:</label>
            <input id="consultas-fecha" type="date" value={anchor} onChange={(event) => { if (event.target.value) void loadWeek(event.target.value); }} disabled={loading} className="min-h-9 rounded-lg border border-border bg-white px-3 text-foreground disabled:opacity-50" />
            {scope === "week" && weekStart(anchor) !== weekStart(today) && <button type="button" onClick={() => void loadWeek(today, "today")} disabled={loading} className="font-semibold text-teal-700 hover:underline disabled:opacity-50">Volver a hoy</button>}
          </div>
        )}

        {!searchActive && weekError && <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800 sm:px-6">{weekError} <button type="button" onClick={() => void loadWeek(failedDate ?? anchor, failedDate && weekStart(failedDate) !== weekStart(today) ? "week" : scope)} className="ml-2 font-semibold underline">Reintentar</button></div>}
        {statusError && <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800 sm:px-6">{statusError}</div>}
        {searchActive && !searchLoading && searchResults && <p role="status" className="border-b border-border bg-teal-50/50 px-5 py-2 text-sm text-teal-900 sm:px-6">{searchResults.length} {searchResults.length === 1 ? "consulta encontrada" : "consultas encontradas"}{searchHasMore ? " · Mostrando las 50 más recientes; escribe un nombre más específico" : ""}</p>}
        {searchError ? <div role="alert" className="px-6 py-10 text-center text-sm text-red-800">{searchError} <button type="button" onClick={() => updateSearch(searchQuery)} className="ml-2 font-semibold underline">Reintentar</button></div> : (searchActive ? searchLoading : loading) ? <div role="status" className="px-6 py-14 text-center text-sm text-muted-foreground">{searchActive ? "Buscando consultas…" : "Cargando consultas…"}</div> : visible.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Stethoscope className="h-6 w-6" aria-hidden="true" /></span>
            <h3 className="mt-4 font-semibold">{professionalFilter !== "all" || careFilter !== "all" ? "No hay consultas con estos filtros" : searchActive ? "No encontramos consultas con ese nombre" : scope === "today" ? "No hay consultas veterinarias hoy" : "No hay consultas veterinarias en esta semana"}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{professionalFilter !== "all" || careFilter !== "all" ? "Cambia la asignación o el estado para ver otras consultas." : searchActive ? "Prueba con otro nombre de mascota o propietario." : "Elige otra semana para consultar atenciones anteriores o revisa la agenda."}</p>
            {(professionalFilter !== "all" || careFilter !== "all") && <button type="button" onClick={() => { setProfessionalFilter("all"); setCareFilter("all"); }} className="mt-4 text-sm font-semibold text-teal-700 hover:underline">Quitar filtros</button>}
            {!searchActive && scope === "today" && veterinaryAppointments.length > 0 && (
              <button type="button" onClick={() => setScope("week")} className="mt-4 text-sm font-semibold text-teal-700 hover:underline">Ver esta semana</button>
            )}
          </div>
        ) : (
          <div>
            {GROUPS.map((group) => {
              const items = visible.filter((appointment) => careGroup(appointment, today) === group).sort((a, b) => searchActive ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
              if (items.length === 0) return null;
              return <section key={group} aria-label={`${group}: ${items.length} consultas`}>
                <h3 className="border-b border-border bg-slate-50 px-5 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 sm:px-6">{group} ({items.length})</h3>
                <ul className="divide-y divide-border">
            {items.map((appointment) => {
              const canRecord = Boolean(appointment.petId) && ["in_progress", "completed"].includes(appointment.status);
              const canManage = !isVet || Boolean(clinicianStaffId && (
                appointment.staffId === clinicianStaffId ||
                (!appointment.staffId && ["confirmed", "arrived"].includes(appointment.status))
              ));
              const date = bogotaDate(appointment.date);
              const priorDay = date < today;
              const graceExpired = arrivalWindowExpired(appointment.date, nowMs);
              const calendarParams = new URLSearchParams({ date });
              if (preview) calendarParams.set("preview", "1");

              return (
                <li key={appointment.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl" aria-hidden="true">{getPetEmoji(appointment.petType)}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-foreground">{appointment.petName}</h4>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(appointment.status)}`}>{formatStatus(appointment.status)}</span>
                        {canRecord && <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${appointment.hasMedicalRecord ? "border-teal-200 bg-teal-50 text-teal-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{appointment.hasMedicalRecord ? "Historia guardada" : "Historia pendiente"}</span>}
                        {priorDay && !["completed", "cancelled", "no_show"].includes(appointment.status) && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Cita anterior por revisar</span>}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{appointment.clientName || appointment.clientPhone || "Cliente sin nombre"} · {appointment.serviceName ?? "Consulta veterinaria"}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{appointmentDate(appointment.date)} · {appointmentTime(appointment.date)}{appointment.staffName ? ` · ${appointment.staffName}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[60px] sm:pl-0">
                    {appointment.petId && !preview && !isVet && (
                      <Link href={`/dashboard/contacto?pet=${encodeURIComponent(appointment.petId)}`} className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted">Ver historia</Link>
                    )}
                    {!preview && canManage && appointment.status === "confirmed" && !graceExpired && <button type="button" disabled={statusBusyId === appointment.id} onClick={() => void advanceAppointment(appointment, "arrived")} className="inline-flex min-h-9 items-center rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-900 hover:bg-teal-100 disabled:opacity-50">{statusBusyId === appointment.id ? "Actualizando…" : "Registrar llegada"}</button>}
                    {!preview && canManage && appointment.status === "arrived" && !priorDay && <button type="button" disabled={statusBusyId === appointment.id} onClick={() => void advanceAppointment(appointment, "in_progress")} className="inline-flex min-h-9 items-center rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{statusBusyId === appointment.id ? "Actualizando…" : "Iniciar atención"}</button>}
                    {!preview && ["pending", "confirmed"].includes(appointment.status) && graceExpired && <span className="text-xs font-medium text-amber-800">Tolerancia vencida · cierre automático pendiente</span>}
                    {!preview && appointment.status === "arrived" && priorDay && (isVet ? <span className="text-xs text-amber-800">Llegada antigua: solicita revisión</span> : <Link href={`/dashboard/calendar?${calendarParams.toString()}`} className="inline-flex min-h-9 items-center rounded-lg border border-amber-200 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-50">Revisar en agenda</Link>)}
                    {canRecord ? (
                      <button type="button" onClick={() => setSelected(appointment)} className="inline-flex min-h-9 items-center rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800">
                        {preview ? "Explorar formulario" : appointment.hasMedicalRecord ? canManage ? "Ver o editar registro" : "Ver registro" : canManage ? "Registrar atención" : "Ver paciente"}
                      </button>
                    ) : appointment.status === "pending" && graceExpired ? null : appointment.status === "pending" && isVet ? <span className="text-xs text-amber-800">Pendiente de confirmación</span> : appointment.status === "pending" ? (
                      <Link href={`/dashboard/calendar?${calendarParams.toString()}`} className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted">Ver en agenda</Link>
                    ) : !appointment.petId ? <span className="text-xs text-amber-800">Asocia una mascota para registrar atención</span> : null}
                    {!preview && canManage && appointment.status === "in_progress" && appointment.hasMedicalRecord && <button type="button" disabled={statusBusyId === appointment.id} onClick={() => void advanceAppointment(appointment, "completed")} className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50">{statusBusyId === appointment.id ? "Finalizando…" : "Finalizar cita"}</button>}
                    {!canManage && <span className="text-xs text-slate-500">{appointment.staffName ? `Asignada a ${appointment.staffName}` : "Solicita al administrador que te asigne esta atención"}</span>}
                  </div>
                </li>
              );
            })}
                </ul>
              </section>;
            })}
          </div>
        )}
      </section>

      {selected && (
        <VetRecordSheet
          appointment={selected}
          open
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          onSaved={() => {
            setWeekAppointments((previous) => previous.map((item) => item.id === selected.id ? { ...item, hasMedicalRecord: true } : item));
            setSearchResults((previous) => previous?.map((item) => item.id === selected.id ? { ...item, hasMedicalRecord: true } : item) ?? null);
            setSelected((previous) => previous ? { ...previous, hasMedicalRecord: true } : previous);
          }}
          preview={preview}
          readOnly={isVet && (!clinicianStaffId || selected.staffId !== clinicianStaffId)}
        />
      )}
    </div>
  );
}
