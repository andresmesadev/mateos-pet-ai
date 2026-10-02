"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
export function TeamPermissions({ member, onSaved }: { member: { id: string; role: string; accessPermissions?: string[] }; onSaved: () => Promise<void> }) {
  const [selected, setSelected] = useState(member.accessPermissions ?? []);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const tenant = useTenant();
  if (member.role === "admin") return <p className="mt-3 text-xs text-muted-foreground">Administrador: acceso completo a las áreas habilitadas, Caja y configuración del equipo.</p>;
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(proxyUrl("/api/dashboard/staff/" + member.id + "/access" + tenantQuery(tenant)), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessPermissions: selected }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron guardar");
      await onSaved(); setMessage("Permisos guardados. Se aplican sin crear otra cuenta.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron guardar"); }
    finally { setBusy(false); }
  }
  const options = [{ id: "cash", label: "Caja operativa", detail: "Cobrar y revisar movimientos de hoy; sin egresos, comisiones ni reportes generales." }, { id: "appointment_price", label: "Ajustar precio de una cita", detail: "Solo citas abiertas; las tarifas del catálogo y de futuras visitas siguen a cargo del administrador." }];
  return <fieldset className="mt-4 space-y-3 rounded-xl border bg-slate-50 p-4"><legend className="px-2 text-sm font-semibold">Permisos adicionales</legend>
    {options.map(option => { const implicit = member.role === "receptionist" && option.id === "cash"; return <label key={option.id} className="flex items-start gap-3 text-sm">
      <input className="mt-1 accent-teal-700" type="checkbox" checked={implicit || selected.includes(option.id)} disabled={busy || implicit} onChange={event => setSelected(values => event.target.checked ? [...values, option.id] : values.filter(value => value !== option.id))} />
      <span><span className="font-semibold">{option.label}{implicit ? " · incluida en Recepción" : ""}</span><span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span></span>
    </label>; })}
    <Button size="sm" disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar permisos"}</Button>{message && <p role="status" className="text-xs">{message}</p>}
  </fieldset>;
}
