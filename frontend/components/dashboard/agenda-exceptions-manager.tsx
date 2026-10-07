"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Pencil, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { useToast } from "@/components/ui/toast";

type Scope = "all" | "vet" | "grooming";
type Mode = "closed" | "open";
type AgendaException = {
  id: string; scope: Scope; mode: Mode; startDate: string; endDate: string | null;
  open: string | null; close: string | null; reason: string | null;
};
type AffectedAppointment = { id: string; date: string; petName: string; serviceType: string; user: { name: string | null; phone: string } };
type Draft = { scope: Scope; mode: Mode; startDate: string; endDate: string; open: string; close: string; reason: string };
type Props = { disabled?: boolean; onDirtyChange?: (dirty: boolean) => void; onSavingChange?: (saving: boolean) => void };
const blank: Draft = { scope: "all", mode: "closed", startDate: "", endDate: "", open: "09:00", close: "13:00", reason: "" };
const scopeLabel: Record<Scope, string> = { all: "Todo el negocio", vet: "Veterinaria", grooming: "Peluquería" };
const selectClass = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
function dateLabel(value: string) { return new Date(value + "T12:00:00-05:00").toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" }); }

export function AgendaExceptionsManager({ disabled = false, onDirtyChange, onSavingChange }: Props) {
  const tenant = useTenant();
  const { toast } = useToast();
  const [items, setItems] = useState<AgendaException[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AgendaException | null>(null);
  const [preview, setPreview] = useState<AffectedAppointment[] | null>(null);
  const [form, setForm] = useState<Draft>({ ...blank });
  const [baseline, setBaseline] = useState(JSON.stringify(blank));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const request = useRef(false);
  const dirty = JSON.stringify(form) !== baseline;
  const locked = disabled || busy;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(busy); }, [busy, onSavingChange]);

  async function load() {
    setLoading(true); setLoadError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/agenda-exceptions${tenantQuery(tenant)}`));
      if (!res.ok) throw new Error("No se pudieron cargar las fechas especiales.");
      setItems((await res.json()).exceptions ?? []);
    } catch (err) { setLoadError(err instanceof Error ? err.message : "No se pudieron cargar las fechas especiales."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let cancelled = false;
    fetch(proxyUrl(`/api/dashboard/agenda-exceptions${tenantQuery(tenant)}`))
      .then(async res => { if (!res.ok) throw new Error("No se pudieron cargar las fechas especiales."); return res.json(); })
      .then(data => { if (!cancelled) { setItems(data.exceptions ?? []); setLoadError(null); } })
      .catch(() => { if (!cancelled) setLoadError("No se pudieron cargar las fechas especiales."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenant]);

  function change<K extends keyof Draft>(field: K, value: Draft[K]) {
    setForm(prev => ({ ...prev, [field]: value })); setPreview(null); setError(null); setNotice(null);
  }
  function reset() {
    setForm({ ...blank }); setBaseline(JSON.stringify(blank)); setEditingId(null);
    setPreview(null); setError(null); setNotice(null);
  }
  function startEdit(item: AgendaException) {
    const next = { scope: item.scope, mode: item.mode, startDate: item.startDate, endDate: item.endDate ?? "", open: item.open ?? "09:00", close: item.close ?? "13:00", reason: item.reason ?? "" };
    setEditingId(item.id); setForm(next); setBaseline(JSON.stringify(next)); setPreview(null); setError(null); setNotice(null);
  }
  function validationError() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)) return "Selecciona la fecha de inicio.";
    if (form.endDate && form.endDate < form.startDate) return "La fecha final debe ser igual o posterior al inicio.";
    if (form.mode === "open") {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.close)) return "Completa la apertura y el cierre, por ejemplo 09:00 o 10:30.";
      if (form.open >= form.close) return "El cierre debe ser posterior a la apertura.";
    }
    return null;
  }
  async function submit(review: boolean) {
    if (request.current || locked) return;
    const validation = validationError();
    if (validation) { setError(validation); return; }
    request.current = true; setBusy(true); setError(null); setNotice(null);
    const payload = { ...form, endDate: form.endDate || null, open: form.mode === "open" ? form.open : null, close: form.mode === "open" ? form.close : null, reason: form.reason || null };
    try {
      const path = review ? "/api/dashboard/agenda-exceptions/preview" : editingId ? `/api/dashboard/agenda-exceptions/${editingId}` : "/api/dashboard/agenda-exceptions";
      const res = await fetch(proxyUrl(path + tenantQuery(tenant)), { method: review || !editingId ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(res.status === 503 ? "El servidor no está disponible. Tus cambios siguen aquí; intenta de nuevo." : data?.error ?? "No se pudo guardar la fecha especial.");
      if (!review) { reset(); await load(); setNotice("Fecha especial guardada. Las citas existentes se conservan."); toast("Fecha especial guardada.", "success"); }
      setPreview(data.affectedAppointments ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo completar la operación."); }
    finally { request.current = false; setBusy(false); }
  }
  async function remove() {
    if (!removing || request.current || locked) return;
    request.current = true; setBusy(true); setError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/agenda-exceptions/${removing.id}${tenantQuery(tenant)}`), { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo eliminar la fecha especial.");
      if (editingId === removing.id) reset();
      setRemoving(null); await load(); setNotice("Fecha especial eliminada. Vuelve a aplicar el horario habitual.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo eliminar la fecha especial."); }
    finally { request.current = false; setBusy(false); }
  }

  return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="special-dates-title">
    <header className="flex items-start gap-3 border-b border-border p-5 sm:p-7"><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><CalendarDays aria-hidden="true" className="h-5 w-5" /></div><div><h2 id="special-dates-title" className="text-xl font-bold">Fechas especiales y festivos</h2><p className="mt-1 text-sm text-muted-foreground">Los festivos colombianos cierran por defecto. Registra aquí una apertura, un cierre o un horario especial.</p></div></header>
    <div className="space-y-6 p-5 sm:p-7">
      <form aria-label="Configurar fecha especial" noValidate onSubmit={event => { event.preventDefault(); void submit(false); }} className="space-y-4">
        <h3 className="font-semibold">{editingId ? "Editar fecha especial" : "Nueva fecha especial"}</h3>
        <fieldset disabled={locked} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium"><span>Área de atención</span><select className={selectClass} value={form.scope} onChange={event => change("scope", event.target.value as Scope)}>{Object.entries(scopeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-medium"><span>Cómo atenderá</span><select className={selectClass} value={form.mode} onChange={event => change("mode", event.target.value as Mode)}><option value="closed">Cerrado</option><option value="open">Abierto con horario especial</option></select></label>
            <label className="space-y-1.5 text-sm font-medium"><span>Fecha de inicio</span><Input type="date" value={form.startDate} onInput={event => change("startDate", event.currentTarget.value)} onChange={event => change("startDate", event.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium"><span>Fecha final (opcional)</span><Input type="date" min={form.startDate || undefined} value={form.endDate} onInput={event => change("endDate", event.currentTarget.value)} onChange={event => change("endDate", event.target.value)} /><span className="block text-xs font-normal text-muted-foreground">Déjala vacía si aplica a un solo día.</span></label>
          </div>
          {form.mode === "open" && <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium"><span>Apertura especial</span><Input type="time" step="60" value={form.open} onInput={event => change("open", event.currentTarget.value)} onChange={event => change("open", event.target.value)} /></label><label className="space-y-1.5 text-sm font-medium"><span>Cierre especial</span><Input type="time" step="60" value={form.close} onInput={event => change("close", event.currentTarget.value)} onChange={event => change("close", event.target.value)} /></label></div>}
          <label className="block space-y-1.5 text-sm font-medium"><span>Motivo (opcional)</span><Input value={form.reason} maxLength={240} placeholder="Ej. Inventario anual o jornada especial" onChange={event => change("reason", event.target.value)} /></label>
        </fieldset>
        {error && !removing && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void submit(true)} disabled={locked || !form.startDate}>Revisar citas afectadas</Button><Button type="submit" disabled={locked || !dirty || !form.startDate}><Save aria-hidden="true" />{busy ? "Procesando…" : editingId ? "Guardar fecha especial" : "Crear fecha especial"}</Button>{(dirty || editingId) && <Button type="button" variant="ghost" disabled={locked} onClick={reset}>{editingId ? "Cancelar edición" : "Limpiar formulario"}</Button>}</div>
        <p role="status" className="text-sm text-muted-foreground">{notice ?? (dirty ? "Tienes una fecha especial sin guardar." : "")}</p>
      </form>
      {preview !== null && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">{preview.length} {preview.length === 1 ? "cita activa afectada" : "citas activas afectadas"}</p><p className="text-muted-foreground">No se cancelará ni reprogramará ninguna automáticamente. Revisa las citas en Agenda si necesitas ajustarlas.</p>{preview.length > 0 && <ul className="space-y-2">{preview.slice(0, 8).map(appt => <li key={appt.id}>{new Date(appt.date).toLocaleString("es-CO", { timeZone: "America/Bogota" })} · {appt.petName} · {appt.user.name ?? appt.user.phone}</li>)}</ul>}{preview.length > 8 && <p>Y {preview.length - 8} citas más. Puedes consultarlas en Agenda.</p>}</div>}
      <div className="space-y-3 border-t border-border pt-6"><h3 className="font-semibold">Fechas configuradas</h3>
        {loadError ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p>{loadError}</p><Button type="button" variant="outline" className="mt-3" disabled={locked || loading} onClick={() => void load()}><RefreshCw aria-hidden="true" />Reintentar</Button></div> : loading ? <p role="status" className="text-sm text-muted-foreground">Cargando fechas especiales…</p> : items.length === 0 ? <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">No hay fechas especiales configuradas. Se aplica el horario habitual y el cierre de festivos.</p> : items.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"><div><p className="text-sm font-semibold">{item.mode === "closed" ? "Cerrado" : `Abierto ${item.open}–${item.close}`} · {scopeLabel[item.scope]}</p><p className="mt-1 text-sm text-muted-foreground">{dateLabel(item.startDate)}{item.endDate ? ` a ${dateLabel(item.endDate)}` : ""}</p>{item.reason && <p className="mt-1 text-sm">{item.reason}</p>}</div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={locked || dirty} onClick={() => startEdit(item)}><Pencil aria-hidden="true" />Editar</Button><Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={locked || dirty} onClick={() => { setRemoving(item); setError(null); }}><Trash2 aria-hidden="true" />Eliminar</Button></div></article>)}
        {dirty && items.length > 0 && <p className="text-xs text-muted-foreground">Guarda o cancela los cambios del formulario antes de editar otra fecha.</p>}
      </div>
    </div>
    <Dialog open={!!removing} onOpenChange={open => { if (!open && !busy) { setRemoving(null); setError(null); } }}>
      <DialogContent showClose={!busy}><DialogHeader><DialogTitle>Eliminar fecha especial</DialogTitle><DialogDescription>Volverá a aplicar el horario habitual. Las citas existentes y su historial se conservan.</DialogDescription></DialogHeader><div className="space-y-3 px-6 py-4">{removing && <p className="text-sm font-medium">{scopeLabel[removing.scope]} · {dateLabel(removing.startDate)}{removing.endDate ? ` a ${dateLabel(removing.endDate)}` : ""}</p>}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}</div><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? "Eliminando…" : "Eliminar fecha especial"}</Button></DialogFooter></DialogContent>
    </Dialog>
  </section>;
}
