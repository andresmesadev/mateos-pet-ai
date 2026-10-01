"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GroomingNotesDialog } from "@/components/dashboard/grooming-notes-dialog";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { formatColombiaDateTime, formatStatus } from "@/lib/appointments";
import type { GroomingVisit } from "@/lib/grooming";
import type { TimelineItem } from "@/lib/pets";
import { isGroomingTimelineItem } from "@/lib/contact-profile-utils";

export function PetGroomingHistory({ petId, appointments = [], onSaved }: { petId: string; appointments?: TimelineItem[]; onSaved?: () => void }) {
  const tenant = useTenant();
  const [visits, setVisits] = useState<GroomingVisit[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<GroomingVisit | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(null);
      try {
        const params = new URLSearchParams(tenantQuery(tenant));
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(proxyUrl(`/api/dashboard/grooming/pets/${encodeURIComponent(petId)}/notes?${params}`), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 403 ? "Tu acceso no permite consultar este historial de peluquería." : "No se pudieron cargar las notas de peluquería.");
        const data = await response.json() as { visits: GroomingVisit[]; nextCursor: string | null };
        if (!controller.signal.aborted) { setVisits((previous) => cursor ? [...previous.filter((item) => !data.visits.some((next) => next.id === item.id)), ...data.visits] : data.visits); setNextCursor(data.nextCursor); }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [petId, tenant, cursor, retry]);

  async function openVisit(id: string, date: string) {
    const existing = visits.find((visit) => visit.id === id);
    if (existing) { setSelected(existing); setOpenError(null); return; }
    setOpening(id); setOpenError(null);
    try {
      const dateKey = new Date(date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
      const params = new URLSearchParams(tenantQuery(tenant)); params.set("date", dateKey);
      const response = await fetch(proxyUrl(`/api/dashboard/grooming/appointments?${params}`), { cache: "no-store" });
      const payload = await response.json() as { appointments?: GroomingVisit[]; error?: string };
      if (!response.ok || !Array.isArray(payload.appointments)) throw new Error(payload.error || "No se pudo cargar la visita.");
      const visit = payload.appointments.find((row) => row.id === id && row.petId === petId);
      if (!visit) throw new Error("La visita no está disponible en esta lista. Búscala por mascota y fecha en Peluquería.");
      setSelected(visit);
    } catch (cause) { setOpenError(cause instanceof Error ? cause.message : "No se pudo abrir la visita."); }
    finally { setOpening(null); }
  }

  const rows = new Map<string, { id: string; date: string; title: string; status: string; notes: string | null }>();
  for (const item of appointments) if (isGroomingTimelineItem(item) && item.appointmentId) rows.set(item.appointmentId, { id: item.appointmentId, date: item.date, title: item.title, status: item.appointmentStatus ?? "", notes: null });
  for (const visit of visits) rows.set(visit.id, { id: visit.id, date: visit.date, title: visit.serviceName || "Peluquería", status: visit.status, notes: visit.groomingNotes });
  const ordered = [...rows.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return <section aria-label="Historial de peluquería" className="space-y-4">
    <div><h3 className="text-lg font-semibold">Visitas y notas de peluquería</h3><p className="mt-1 max-w-prose text-sm text-muted-foreground">Abre una visita para registrar el baño, el corte y los productos utilizados. Las notas se guardan en esa cita.</p></div>
    {openError && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{openError}</p>}
    {ordered.map((row) => <article key={row.id} className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h4 className="font-semibold">{row.title}</h4><p className="mt-1 text-sm text-muted-foreground">{formatColombiaDateTime(row.date)}</p></div>
        <span className="text-xs text-muted-foreground">{formatStatus(row.status)}</span>
      </div>
      {row.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{row.notes}</p>}
      <Button variant="outline" className="mt-3 min-h-11" disabled={Boolean(opening) || loading || Boolean(error)} onClick={() => void openVisit(row.id, row.date)}>{opening === row.id ? "Abriendo visita…" : ["cancelled", "no_show"].includes(row.status) ? "Consultar notas de esta visita" : "Abrir notas de esta visita"}</Button>
    </article>)}
    {loading && <p role="status" className="text-sm text-muted-foreground">Cargando notas…</p>}
    {error && <div role="alert" className="rounded-xl border p-4 text-sm"><p>{error}</p><Button variant="outline" className="mt-2" onClick={() => setRetry((value) => value + 1)}>Reintentar</Button></div>}
    {!loading && !error && ordered.length === 0 && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Todavía no hay visitas de peluquería para esta mascota. Crea una cita de baño o corte para registrar sus notas.</p>}
    {!loading && !error && nextCursor && <Button variant="outline" onClick={() => setCursor(nextCursor)}>Ver notas de visitas anteriores</Button>}
    {selected && <GroomingNotesDialog key={selected.id} visit={selected} tenantId={tenant ?? undefined} onClose={() => setSelected(null)} onSaved={(updated) => { setSelected(updated); setCursor(null); setRetry((value) => value + 1); onSaved?.(); }} />}
  </section>;
}
