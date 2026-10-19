"use client";
import { useEffect, useId, useState } from "react";
import { Save, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { formatCOP } from "@/lib/transactions";

export function PetGroomingPrices({ petId, onEditStateChange }: { petId: string; onEditStateChange?: (state: { dirty: boolean; saving: boolean }) => void }) {
  const fieldId = useId();
  const tenant = useTenant(); const [center, setCenter] = useState(""); const [transport, setTransport] = useState("");
  const [ready, setReady] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const [previousTotal, setPreviousTotal] = useState<number | null>(null);
  const [saved, setSaved] = useState({ center: "", transport: "" });
  const dirty = ready && (center !== saved.center || transport !== saved.transport);
  useEffect(() => { onEditStateChange?.({ dirty, saving }); }, [dirty, saving, onEditStateChange]);
  useEffect(() => () => onEditStateChange?.({ dirty: false, saving: false }), [onEditStateChange]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(proxyUrl(`/api/dashboard/pets/${petId}/grooming-prices${tenantQuery(tenant)}`), { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("No se pudieron cargar los precios de peluquería."); return response.json();
    }).then(body => { if (!controller.signal.aborted) { const prices = { center: body.center == null ? "" : String(body.center), transport: body.transport == null ? "" : String(body.transport) }; setCenter(prices.center); setTransport(prices.transport); setSaved(prices); setPreviousTotal(body.previousTotal ?? null); setReady(true); } }).catch(cause => { if (!controller.signal.aborted) setMessage(cause.message); });
    return () => controller.abort();
  }, [petId, tenant]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (saving) return; setSaving(true); setMessage("");
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/pets/${petId}/grooming-prices${tenantQuery(tenant)}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ center: center.trim() ? Number(center) : null, transport: transport.trim() ? Number(transport) : null }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudieron guardar los precios.");
      if (body.id !== petId) throw new Error("No se pudo confirmar el guardado."); setSaved({ center, transport }); setPreviousTotal(body.previousTotal ?? null); setMessage("Precios guardados.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se pudieron guardar los precios."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} aria-label="Precios de peluquería" className="space-y-4 rounded-xl border border-primary/15 bg-primary/[0.03] p-4 sm:p-5">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><Scissors aria-hidden="true" className="h-4 w-4 text-primary" />Peluquería y domicilio</h3>
    <fieldset disabled={!ready || saving} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><label htmlFor={`${fieldId}-service`} className="block text-sm font-semibold">Valor del servicio (COP)</label><Input id={`${fieldId}-service`} type="number" min="0" max="99999999.99" step="0.01" value={center} onChange={event => setCenter(event.target.value)} className="h-11" placeholder="Por confirmar" /></div>
      <div className="space-y-2"><label htmlFor={`${fieldId}-transport`} className="block text-sm font-semibold">Valor del domicilio (COP)</label><Input id={`${fieldId}-transport`} type="number" min="0" max="99999999.99" step="0.01" value={transport} onChange={event => setTransport(event.target.value)} className="h-11" placeholder="Por confirmar" /></div>
    </fieldset>
    <p className="text-xs text-muted-foreground">Domicilio adicional al servicio, con recogida y entrega. Vacío: por confirmar. 0: gratuito.</p>
    {previousTotal != null && <p className="text-sm text-amber-800">Total anterior con domicilio: {formatCOP(previousTotal)}. Confirma ambos valores antes de reemplazarlo.</p>}
    <div className="flex justify-end"><Button type="submit" variant="outline" className="min-h-11 gap-2 border-primary/20 bg-background text-primary" disabled={!ready || saving || !dirty}><Save aria-hidden="true" className="h-4 w-4" />{saving ? "Guardando…" : "Guardar precios"}</Button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
