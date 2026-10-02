"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { type DashboardPet, formatPetType } from "@/lib/pets";
export function OperationalAlerts({ pet, onSaved }: { pet: DashboardPet; onSaved?: () => void }) {
  const [text, setText] = useState(pet.operationalAlerts ?? ""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const tenant = useTenant();
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(proxyUrl("/api/dashboard/pets/" + pet.id + tenantQuery(tenant)), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationalAlerts: text }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar");
      setMessage("Alertas operativas guardadas."); onSaved?.();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"><h3 className="font-semibold">Alertas para el manejo</h3><p className="text-sm text-muted-foreground">Indicaciones que debe conocer el equipo al recibir o cuidar a la mascota. El diagnóstico y el tratamiento se registran en la historia clínica.</p><label className="block text-sm"><span className="sr-only">Alertas operativas de {pet.name}</span><textarea className="mt-2 w-full rounded-lg border bg-white p-3" rows={3} maxLength={2000} placeholder="Ej. Se asusta con el secador; evitar sujetar por la pata derecha." value={text} onChange={event => setText(event.target.value)} /></label><Button size="sm" disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar alertas"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</section>;
}
export function OperationalPetSheet({ pet, open, onOpenChange, onUpdated }: { pet: DashboardPet | null; open: boolean; onOpenChange: (open: boolean) => void; onUpdated?: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Ficha de {pet?.name}</DialogTitle><DialogDescription>Datos de identificación y manejo de la mascota.</DialogDescription></DialogHeader>
    {pet && <><dl className="grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Mascota</dt><dd className="font-semibold">{pet.name} · {formatPetType(pet.type)}</dd></div><div><dt className="text-muted-foreground">Raza</dt><dd>{pet.breed || "Sin registrar"}</dd></div><div><dt className="text-muted-foreground">Propietario</dt><dd>{pet.owner.name || "Sin nombre"}</dd></div><div><dt className="text-muted-foreground">Teléfono</dt><dd>{pet.owner.phone}</dd></div></dl><OperationalPetBasics key={pet.id} pet={pet} onUpdated={onUpdated} /><OperationalAlerts key={pet.id + "-alerts"} pet={pet} onSaved={onUpdated} /></>}
  </DialogContent></Dialog>;
}
function OperationalPetBasics({ pet, onUpdated }: { pet: DashboardPet; onUpdated?: () => void }) {
  const [name, setName] = useState(pet.name), [breed, setBreed] = useState(pet.breed ?? ""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const tenant = useTenant();
  async function save() {
    setBusy(true);
    try {
      const response = await fetch(proxyUrl("/api/dashboard/pets/" + pet.id + tenantQuery(tenant)), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, breed }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar");
      setMessage("Datos básicos guardados."); onUpdated?.();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">Datos básicos</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Nombre<input className="mt-1 block w-full rounded-lg border p-3" value={name} onChange={event => setName(event.target.value)} /></label><label className="text-sm">Raza<input className="mt-1 block w-full rounded-lg border p-3" value={breed} onChange={event => setBreed(event.target.value)} /></label></div><Button size="sm" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar datos"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</section>;
}
