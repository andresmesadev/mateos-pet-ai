"use client";

import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { formatColombiaDateTime } from "@/lib/appointments";
import { type GroomingVisit } from "@/lib/grooming";

export function GroomingNotesDialog({ visit, tenantId, onClose, onSaved }: {
  visit: GroomingVisit; tenantId?: string; onClose: () => void; onSaved: (visit: GroomingVisit) => void;
}) {
  const [current, setCurrent] = useState(visit);
  const [notes, setNotes] = useState(visit.groomingNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [history, setHistory] = useState<GroomingVisit[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const dirty = notes !== (current.groomingNotes ?? "");
  const canWrite = Boolean(visit.petId) && !["cancelled", "no_show"].includes(visit.status);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (dirty || saving) { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  function requestClose() {
    if (saving || historyBusy) return;
    if (dirty) setDiscardOpen(true); else onClose();
  }

  async function loadHistory(nextCursor?: string) {
    if (!visit.petId) return;
    setHistoryBusy(true);
    setHistoryError(null);
    try {
      const params = new URLSearchParams({ exclude: visit.id });
      if (tenantId) params.set("tenantId", tenantId);
      if (nextCursor) params.set("cursor", nextCursor);
      const response = await fetch(proxyUrl(`/api/dashboard/grooming/pets/${encodeURIComponent(visit.petId)}/notes?${params}`), { cache: "no-store" });
      const payload = await response.json() as { visits?: GroomingVisit[]; nextCursor?: string | null; error?: string };
      if (!response.ok || !Array.isArray(payload.visits)) throw new Error(payload.error ?? "No se pudieron cargar las notas anteriores.");
      const rows = payload.visits;
      setHistory((existing) => nextCursor ? [...existing, ...rows] : rows);
      setCursor(payload.nextCursor ?? null);
      setHistoryLoaded(true);
    } catch (cause) { setHistoryError(cause instanceof Error ? cause.message : "Intenta de nuevo."); }
    finally { setHistoryBusy(false); }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tenantId) params.set("tenantId", tenantId);
      const response = await fetch(proxyUrl(`/api/dashboard/grooming/appointments/${encodeURIComponent(visit.id)}/notes${params.size ? `?${params}` : ""}`), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, expectedVersion: current.groomingNotesVersion }),
      });
      const payload = await response.json() as GroomingVisit & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron guardar las notas.");
      setCurrent(payload);
      setNotes(payload.groomingNotes ?? "");
      onSaved(payload);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Intenta de nuevo."); }
    finally { setSaving(false); }
  }

  return <>
    <Dialog open onOpenChange={(open) => { if (!open) requestClose(); }}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl" showClose={!saving}>
        <DialogHeader className="border-b px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3 pr-7"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><Scissors className="size-5" /></span><DialogTitle className="text-xl">Notas de la atención de {visit.petName}</DialogTitle></div>
          <DialogDescription className="pt-2">{visit.clientName ?? "Propietario sin nombre"} · {visit.serviceName ?? "Baño o corte"} · {formatColombiaDateTime(visit.date)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
          <div className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">Anota si la mascota necesita algún cuidado, qué observaste durante el baño, cómo quedó el corte y qué productos utilizaste.</div>
          {!canWrite && <p role="status" className="text-sm text-muted-foreground">{!visit.petId ? "Asocia la mascota a la cita para guardar y consultar sus notas." : "Esta cita está cerrada como cancelada o no asistida. Sus notas se conservan para consulta."}</p>}
          <div className="space-y-2">
            <label htmlFor="grooming-notes" className="text-sm font-semibold">Notas de esta visita</label>
            <textarea id="grooming-notes" value={notes} disabled={!canWrite || saving} onChange={(event) => setNotes(event.target.value)} maxLength={6000} rows={9} placeholder="Ej. Corte corto en el cuerpo y patas redondeadas. Se utilizó champú para piel sensible. Se observaron nudos detrás de las orejas; se retiraron con cuidado." className="w-full resize-y rounded-xl border border-border bg-white p-4 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-muted" />
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span aria-live="polite">{dirty ? "Tienes cambios sin guardar" : current.groomingNotesUpdatedAt ? `Guardado: ${formatColombiaDateTime(current.groomingNotesUpdatedAt)}` : "Las notas se guardan en esta visita"}</span><span>{notes.length}/6000</span></div>
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} Tu texto sigue aquí. Si la nota cambió, cierra y vuelve a abrir la cita para consultar la versión vigente antes de corregirla.</p>}
          {visit.petId && <details className="rounded-xl border p-4" onToggle={(event) => { if (event.currentTarget.open && !historyLoaded && !historyBusy && !historyError) void loadHistory(); }}>
            <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-teal-600">Notas de otras visitas</summary>
            <div className="mt-4 space-y-3">
              {history.map((item) => <article key={item.id} className="rounded-lg bg-slate-50 p-4"><p className="text-sm font-semibold">{item.serviceName ?? "Peluquería"} · {formatColombiaDateTime(item.date)}</p><p className="mt-1 text-xs text-muted-foreground">{item.staffName ? `Atendió: ${item.staffName}` : "Sin peluquero registrado"}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.groomingNotes}</p></article>)}
              {historyLoaded && !history.length && <p className="text-sm text-muted-foreground">Aún no hay notas guardadas en otras citas de peluquería. Los registros anteriores de la ficha general siguen en Clientes y mascotas.</p>}
              {historyBusy && <p role="status" className="text-sm text-muted-foreground">Cargando notas…</p>}
              {historyError && <div role="alert" className="text-sm text-red-800"><p>{historyError}</p><Button variant="outline" className="mt-2" onClick={() => void loadHistory(cursor ?? undefined)}>Reintentar</Button></div>}
              {cursor && !historyBusy && !historyError && <Button variant="outline" onClick={() => void loadHistory(cursor)}>Ver más visitas</Button>}
            </div>
          </details>}
        </div>
        <DialogFooter className="border-t bg-white px-6 py-4 sm:px-8"><Button variant="outline" onClick={requestClose} disabled={saving || historyBusy}>Cerrar</Button>{canWrite && <Button onClick={() => void save()} disabled={saving || !dirty}>{saving ? "Guardando…" : "Guardar notas"}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={discardOpen} onOpenChange={setDiscardOpen}><DialogContent><DialogHeader><DialogTitle>¿Cerrar sin guardar?</DialogTitle><DialogDescription>Las notas que escribiste en esta visita todavía no se han guardado.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDiscardOpen(false)}>Seguir escribiendo</Button><Button variant="destructive" onClick={onClose}>Descartar y cerrar</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
