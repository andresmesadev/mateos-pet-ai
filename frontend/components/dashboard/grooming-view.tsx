"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarPlus, CheckCheck, Clock3, Scissors, Search, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppointmentDetailDialog } from "@/components/dashboard/appointment-detail-dialog";
import { NewAppointmentDialog } from "@/components/dashboard/new-appointment-dialog";
import { GroomingNotesDialog } from "@/components/dashboard/grooming-notes-dialog";
import { proxyUrl } from "@/lib/api";
import { arrivalWindowExpired, formatColombiaDateTime, formatService, formatStatus, type TodayAppointment } from "@/lib/appointments";
import { GROOMING_STAGES, groomingStage, type GroomingVisit } from "@/lib/grooming";
import { getPetEmoji } from "@/lib/pets";

type ListResult = { key: string; appointments: GroomingVisit[]; hasMore: boolean; error: string | null };

export function GroomingView({ initialVisits, initialHasMore, initialError, tenantId }: {
  initialVisits: GroomingVisit[]; initialHasMore: boolean; initialError: string | null; tenantId?: string;
}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [stage, setStage] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [refresh, setRefresh] = useState(0);
  const key = `${date}:${term}:${refresh}`;
  const [result, setResult] = useState<ListResult>({ key: `${today}::0`, appointments: initialVisits, hasMore: initialHasMore, error: initialError });
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [staffError, setStaffError] = useState(false);
  const [notesVisit, setNotesVisit] = useState<GroomingVisit | null>(null);
  const [detailVisit, setDetailVisit] = useState<GroomingVisit | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ visit: GroomingVisit; action: "complete" | "delivery" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const bootstrapped = useRef(false);
  const loading = result.key !== key;

  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); if (!busy && !notesVisit && !detailVisit && !confirm && !newOpen) setRefresh((value) => value + 1); }, 60_000);
    return () => clearInterval(timer);
  }, [busy, notesVisit, detailVisit, confirm, newOpen]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (tenantId) params.set("tenantId", tenantId);
    void fetch(proxyUrl(`/api/dashboard/staff${params.size ? `?${params}` : ""}`), { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ id: string; name: string; role: string }[]>; })
      .then((rows) => { if (!controller.signal.aborted) setStaff(rows.filter((item) => item.role === "groomer")); })
      .catch(() => { if (!controller.signal.aborted) setStaffError(true); });
    return () => controller.abort();
  }, [tenantId]);
  useEffect(() => {
    if (!bootstrapped.current) {
      bootstrapped.current = true;
      if (key === `${today}::0`) return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ date });
    if (term.length >= 2) params.set("search", term);
    if (tenantId) params.set("tenantId", tenantId);
    void fetch(proxyUrl(`/api/dashboard/grooming/appointments?${params}`), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { appointments?: GroomingVisit[]; hasMore?: boolean; error?: string };
        if (!response.ok || !Array.isArray(payload.appointments)) throw new Error(payload.error ?? "No se pudieron cargar las citas.");
        if (!controller.signal.aborted) setResult({ key, appointments: payload.appointments, hasMore: Boolean(payload.hasMore), error: null });
      })
      .catch((cause) => { if (!controller.signal.aborted) setResult({ key, appointments: [], hasMore: false, error: cause instanceof Error ? cause.message : "Intenta de nuevo." }); });
    return () => controller.abort();
  }, [date, term, refresh, tenantId, key, today]);

  function updateVisit(updated: GroomingVisit) {
    setResult((current) => ({ ...current, appointments: current.appointments.map((item) => item.id === updated.id ? updated : item) }));
    setDetailVisit(null);
  }

  async function advance(visit: GroomingVisit, action: "confirmed" | "arrived" | "in_progress" | "complete" | "delivery") {
    setBusy(visit.id);
    setActionError(null);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      if (tenantId) params.set("tenantId", tenantId);
      const endpoint = action === "delivery" ? `/api/dashboard/grooming/appointments/${visit.id}/delivery` : `/api/dashboard/appointments/${visit.id}${action === "complete" ? "/complete" : ""}`;
      const response = await fetch(proxyUrl(`${endpoint}${params.size ? `?${params}` : ""}`), {
        method: ["complete", "delivery"].includes(action) ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(["complete", "delivery"].includes(action) ? {} : { status: action }),
      });
      const payload = await response.json() as Partial<GroomingVisit> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Intenta de nuevo.");
      updateVisit({ ...visit, ...payload } as GroomingVisit);
      setConfirm(null);
      setNotice(action === "delivery" ? `Entrega de ${visit.petName} registrada.` : action === "complete" ? `${visit.petName}: servicio terminado, pendiente de entrega.` : `Estado de ${visit.petName} actualizado.`);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "No se pudo actualizar la cita."); }
    finally { setBusy(null); }
  }

  const filtered = result.appointments.filter((item) => staffFilter === "all" || (staffFilter === "unassigned" ? !item.staffId : item.staffId === staffFilter));
  const visible = filtered.filter((item) => stage === "all" || groomingStage(item, today) === stage);
  const money = (amount: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
  const scopeLabel = term.length >= 2 ? "Resultados de todas las fechas" : `Citas del ${new Date(`${date}T12:00:00Z`).toLocaleDateString("es-CO", { dateStyle: "long", timeZone: "UTC" })}`;
  const agendaHref = `/dashboard/calendar${tenantId ? `?tenant=${encodeURIComponent(tenantId)}` : ""}`;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-sm text-muted-foreground">Recibe la mascota, registra el baño o corte y confirma su entrega al propietario.</p><Button onClick={() => setNewOpen(true)}><CalendarPlus className="size-4" /> Nueva cita</Button></div>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm" aria-labelledby="grooming-list-title">
      <div className="space-y-4 border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1"><label htmlFor="grooming-search" className="mb-1.5 block text-sm font-semibold">Buscar mascota o propietario</label><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input id="grooming-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={80} placeholder="Ej. Toby o Ana García" className="min-h-10 w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600" /></div></div>
          <div><label htmlFor="grooming-date" className="mb-1.5 block text-sm font-semibold">Día de atención</label><input id="grooming-date" type="date" disabled={term.length >= 2} value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} className="min-h-10 rounded-lg border bg-white px-3 text-sm disabled:bg-muted" /></div>
          <Button variant="outline" onClick={() => { setSearch(""); setTerm(""); setDate(today); setStage("all"); setStaffFilter("all"); setRefresh((value) => value + 1); }}>Hoy</Button>
          <div><label htmlFor="grooming-staff" className="mb-1.5 block text-sm font-semibold">Peluquero responsable</label><select id="grooming-staff" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} className="min-h-10 max-w-64 rounded-lg border bg-white px-3 text-sm"><option value="all">Todos</option><option value="unassigned">Sin asignar</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <Button variant="outline" disabled={loading || Boolean(busy)} onClick={() => setRefresh((value) => value + 1)}>Actualizar</Button>
        </div>
        {staffError && <p role="status" className="text-sm text-amber-800">No se pudo cargar el filtro de peluqueros. Puedes revisar el responsable en cada cita.</p>}
        <div className="flex flex-wrap gap-2" aria-label="Etapa de peluquería"><button type="button" aria-pressed={stage === "all"} onClick={() => setStage("all")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${stage === "all" ? "bg-teal-700 text-white" : "bg-slate-50 text-slate-600"}`}>Todas</button>{GROOMING_STAGES.map((label) => <button type="button" key={label} aria-pressed={stage === label} onClick={() => setStage(stage === label ? "all" : label)} className={`rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-teal-600 ${stage === label ? "bg-amber-100 text-amber-950 ring-1 ring-amber-400" : "bg-slate-50 text-slate-600 hover:bg-amber-50"}`}>{label} <span className="ml-1 font-semibold tabular-nums">{loading ? "—" : filtered.filter((item) => groomingStage(item, today) === label).length}</span></button>)}</div>
      </div>
      <div className="border-b bg-slate-50 px-5 py-3 sm:px-6"><h2 id="grooming-list-title" className="text-sm font-semibold">{scopeLabel}</h2>{term.length >= 2 && <p className="mt-1 text-xs text-muted-foreground">La búsqueda incluye visitas anteriores y citas canceladas o no asistidas.</p>}</div>
      {notice && <p role="status" className="mx-5 mt-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">{notice}</p>}
      {actionError && !confirm && <p role="alert" className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}
      {loading ? <p role="status" className="p-8 text-sm text-muted-foreground">Cargando citas de peluquería…</p> : result.error ? <div role="alert" className="space-y-3 p-8"><p className="text-sm text-red-800">{result.error}</p><Button variant="outline" onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button></div> : !visible.length ? <div className="space-y-3 p-8"><h3 className="font-semibold">{filtered.length ? "No hay citas en esta etapa" : term.length >= 2 ? "No encontramos citas con esos nombres" : "No hay citas de peluquería para este día"}</h3><p className="text-sm text-muted-foreground">{filtered.length ? "Prueba con otra etapa o vuelve a Todas." : "Puedes elegir otro día o crear una cita de baño o corte."}</p>{stage !== "all" && <Button variant="outline" onClick={() => setStage("all")}>Ver todas</Button>}</div> : <div className="divide-y">{visible.map((visit) => {
        const visitStage = groomingStage(visit, today);
        const expired = ["pending", "confirmed"].includes(visit.status) && arrivalWindowExpired(visit.date, now);
        const priorArrival = visit.status === "arrived" && visitStage === "Por revisar";
        return <article key={visit.id} className="flex flex-col gap-4 px-5 py-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl">{getPetEmoji(visit.petType)}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{visit.petName}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${visitStage === "Listas para entrega" || visitStage === "Entregadas" ? "bg-teal-50 text-teal-800" : visitStage === "Por revisar" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>{visitStage}</span></div><p className="mt-1 break-words text-sm text-muted-foreground">{visit.clientName ?? "Propietario sin nombre"} · {visit.serviceName ?? formatService(visit.serviceType)}</p><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{formatColombiaDateTime(visit.date)}</span><span>{visit.staffName ?? "Peluquero sin asignar"}</span><span>{visit.finalPrice !== null ? money(visit.finalPrice) : "Precio por asignar"}</span></p>{visit.groomingNotes && <p className="mt-2 line-clamp-2 max-w-xl whitespace-pre-wrap break-words text-sm text-slate-600"><StickyNote className="mr-1 inline size-3.5" />{visit.groomingNotes}</p>}{expired && <p className="mt-2 text-xs text-amber-800">La tolerancia de llegada venció. Revisa la cita en Agenda.</p>}{priorArrival && <p className="mt-2 text-xs text-rose-800">Llegada de un día anterior. Revisa su atención antes de continuar.</p>}{visit.groomingDeliveredAt && <p className="mt-2 text-xs text-teal-800">Entrega registrada: {formatColombiaDateTime(visit.groomingDeliveredAt)}</p>}{["cancelled", "no_show"].includes(visit.status) && <p className="mt-2 text-xs text-muted-foreground">{formatStatus(visit.status)}</p>}</div></div>
          <div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => setDetailVisit(visit)}>Cita y precio</Button><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => setNotesVisit(visit)}><StickyNote className="size-3.5" />{visit.groomingNotes ? "Ver o editar notas" : "Notas de la atención"}</Button>
            {visit.status === "pending" && !expired && <Button size="sm" disabled={Boolean(busy)} onClick={() => void advance(visit, "confirmed")}>Confirmar cita</Button>}
            {visit.status === "confirmed" && !expired && <Button size="sm" disabled={Boolean(busy)} onClick={() => void advance(visit, "arrived")}>Registrar llegada</Button>}
            {visit.status === "arrived" && !priorArrival && <Button size="sm" disabled={Boolean(busy)} onClick={() => void advance(visit, "in_progress")}><Scissors className="size-3.5" />Iniciar baño o corte</Button>}
            {visit.status === "in_progress" && <Button size="sm" disabled={Boolean(busy)} onClick={() => { setActionError(null); setConfirm({ visit, action: "complete" }); }}>Terminar servicio</Button>}
            {visit.status === "completed" && !visit.groomingDeliveredAt && <Button size="sm" disabled={Boolean(busy)} onClick={() => { setActionError(null); setConfirm({ visit, action: "delivery" }); }}><CheckCheck className="size-3.5" />Registrar entrega</Button>}
            {(expired || priorArrival) && <Button variant="outline" size="sm" asChild><Link href={agendaHref}>Revisar en Agenda</Link></Button>}
          </div>
        </article>;
      })}</div>}
      {!loading && result.hasMore && <p role="status" className="border-t p-4 text-sm text-amber-900">Se muestran hasta 100 citas. Precisa el nombre en la búsqueda para ver las restantes.</p>}
    </section>
    {newOpen && <NewAppointmentDialog initialDate={date} serviceCategory="grooming" onClose={() => setNewOpen(false)} onCreated={() => { setNewOpen(false); setRefresh((value) => value + 1); }} />}
    {detailVisit && <AppointmentDetailDialog appointment={detailVisit} onClose={() => setDetailVisit(null)} onUpdated={(updated: TodayAppointment) => { updateVisit({ ...detailVisit, ...updated }); setRefresh((value) => value + 1); }} />}
    {notesVisit && <GroomingNotesDialog key={notesVisit.id} visit={notesVisit} tenantId={tenantId} onClose={() => setNotesVisit(null)} onSaved={(updated) => { updateVisit(updated); setNotice(`Notas de ${updated.petName} guardadas.`); }} />}
    <Dialog open={Boolean(confirm)} onOpenChange={(open) => { if (!open && !busy) setConfirm(null); }}><DialogContent showClose={!busy}><DialogHeader><DialogTitle>{confirm?.action === "delivery" ? `¿Entregaste a ${confirm.visit.petName}?` : `¿Terminaste el servicio de ${confirm?.visit.petName}?`}</DialogTitle><DialogDescription>{confirm?.action === "delivery" ? "Se guardará la fecha de entrega al propietario. No se registra otro cobro ni otra comisión." : "Se completará la cita y se registrarán el cobro y la comisión correspondientes. La mascota quedará pendiente de entrega."}</DialogDescription></DialogHeader>{actionError && <p role="alert" className="text-sm text-red-800">{actionError}</p>}<DialogFooter><Button variant="outline" disabled={Boolean(busy)} onClick={() => setConfirm(null)}>Volver</Button><Button disabled={Boolean(busy)} onClick={() => { if (confirm) void advance(confirm.visit, confirm.action); }}>{busy ? "Guardando…" : confirm?.action === "delivery" ? "Confirmar entrega" : "Terminar servicio"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
