"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

const scopeLabel: Record<Scope, string> = { all: "Todo el negocio", vet: "Veterinaria", grooming: "Peluquería" };

export function AgendaExceptionsManager() {
  const tenant = useTenant();
  const { toast } = useToast();
  const [items, setItems] = useState<AgendaException[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<AffectedAppointment[] | null>(null);
  const [form, setForm] = useState({ scope: "all" as Scope, mode: "closed" as Mode, startDate: "", endDate: "", open: "09:00", close: "13:00", reason: "" });

  const payload = useMemo(() => ({
    scope: form.scope, mode: form.mode, startDate: form.startDate, endDate: form.endDate || null,
    open: form.mode === "open" ? form.open : null, close: form.mode === "open" ? form.close : null,
    reason: form.reason || null,
  }), [form]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/agenda-exceptions${tenantQuery(tenant)}`));
      if (!res.ok) throw new Error("No se pudieron cargar las fechas especiales.");
      setItems((await res.json()).exceptions ?? []);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error al cargar", "error");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let cancelled = false;

    fetch(proxyUrl(`/api/dashboard/agenda-exceptions${tenantQuery(tenant)}`))
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudieron cargar las fechas especiales.");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setItems(data.exceptions ?? []);
      })
      .catch((error: unknown) => {
        if (!cancelled) toast(error instanceof Error ? error.message : "Error al cargar", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tenant, toast]);

  async function review() {
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/agenda-exceptions/preview${tenantQuery(tenant)}`), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo revisar la excepción.");
      setPreview(data.affectedAppointments ?? []);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error al revisar", "error");
    }
  }

  async function save() {
    setSaving(true);
    try {
      const endpoint = editingId ? `/api/dashboard/agenda-exceptions/${editingId}${tenantQuery(tenant)}` : `/api/dashboard/agenda-exceptions${tenantQuery(tenant)}`;
      const res = await fetch(proxyUrl(endpoint), {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar la excepción.");
      setPreview(data.affectedAppointments ?? []);
      setForm({ scope: "all", mode: "closed", startDate: "", endDate: "", open: "09:00", close: "13:00", reason: "" });
      setEditingId(null);
      await load();
      toast("Fecha especial guardada. Las citas existentes no cambiaron.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error al guardar", "error");
    } finally { setSaving(false); }
  }

  function startEdit(item: AgendaException) {
    setEditingId(item.id);
    setPreview(null);
    setForm({ scope: item.scope, mode: item.mode, startDate: item.startDate, endDate: item.endDate ?? "", open: item.open ?? "09:00", close: item.close ?? "13:00", reason: item.reason ?? "" });
  }

  async function remove(id: string) {
    if (!window.confirm("¿Eliminar esta excepción? El horario normal volverá a aplicar.")) return;
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/agenda-exceptions/${id}${tenantQuery(tenant)}`), { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo eliminar.");
      await load();
      toast("Fecha especial eliminada.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error al eliminar", "error");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border border-black/[0.10] border-t-2 border-t-amber-400/50">
        <CardHeader className="pb-3 border-b border-black/[0.06]">
          <CardTitle className="text-sm">Fechas especiales y festivos</CardTitle>
          <p className="text-xs text-muted-foreground">Los festivos colombianos cierran por defecto. Aquí puedes registrar cierres, aperturas u horarios reducidos.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span>Alcance</span><select className="h-9 w-full rounded-md border border-input bg-transparent px-3" value={form.scope} onChange={(e) => setForm((v) => ({ ...v, scope: e.target.value as Scope }))}>{Object.entries(scopeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span>Regla</span><select className="h-9 w-full rounded-md border border-input bg-transparent px-3" value={form.mode} onChange={(e) => { setPreview(null); setForm((v) => ({ ...v, mode: e.target.value as Mode })); }}><option value="closed">Cerrado</option><option value="open">Abierto / horario especial</option></select></label>
            <label className="space-y-1 text-sm"><span>Desde</span><Input type="date" value={form.startDate} onChange={(e) => { setPreview(null); setForm((v) => ({ ...v, startDate: e.target.value })); }} /></label>
            <label className="space-y-1 text-sm"><span>Hasta (opcional)</span><Input type="date" value={form.endDate} onChange={(e) => { setPreview(null); setForm((v) => ({ ...v, endDate: e.target.value })); }} /></label>
          </div>
          {form.mode === "open" && <div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Abre</span><Input type="time" value={form.open} onChange={(e) => { setPreview(null); setForm((v) => ({ ...v, open: e.target.value })); }} /></label><label className="space-y-1 text-sm"><span>Cierra</span><Input type="time" value={form.close} onChange={(e) => { setPreview(null); setForm((v) => ({ ...v, close: e.target.value })); }} /></label></div>}
          <label className="block space-y-1 text-sm"><span>Motivo (opcional)</span><Input value={form.reason} maxLength={240} placeholder="Ej. Inventario anual" onChange={(e) => setForm((v) => ({ ...v, reason: e.target.value }))} /></label>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={review} disabled={!form.startDate}>Revisar citas afectadas</Button><Button onClick={save} disabled={!form.startDate || saving}>{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Guardar fecha especial"}</Button>{editingId && <Button variant="ghost" onClick={() => { setEditingId(null); setPreview(null); setForm({ scope: "all", mode: "closed", startDate: "", endDate: "", open: "09:00", close: "13:00", reason: "" }); }}>Cancelar edición</Button>}</div>
          {preview !== null && <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><p className="font-medium">{preview.length} cita(s) activa(s) afectada(s)</p><p className="mt-1 text-xs text-muted-foreground">No se cancelará ni reprogramará ninguna automáticamente.</p>{preview.length > 0 && <ul className="mt-2 space-y-1 text-xs">{preview.slice(0, 8).map((appt) => <li key={appt.id}>{new Date(appt.date).toLocaleString("es-CO")} · {appt.petName} · {scopeLabel[(appt.serviceType === "grooming" ? "grooming" : "vet") as Scope]} · {appt.user.name ?? appt.user.phone}</li>)}</ul>}</div>}
        </CardContent>
      </Card>
      <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Programadas</p>{loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : items.length === 0 ? <p className="text-sm text-muted-foreground">No hay fechas especiales configuradas.</p> : items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"><div><p className="font-medium">{item.mode === "closed" ? "Cerrado" : `${item.open}–${item.close}`} · {scopeLabel[item.scope]}</p><p className="text-xs text-muted-foreground">{item.startDate}{item.endDate ? ` a ${item.endDate}` : ""}{item.reason ? ` · ${item.reason}` : ""}</p></div><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => startEdit(item)}>Editar</Button><Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(item.id)}>Eliminar</Button></div></div>)}</div>
    </div>
  );
}
