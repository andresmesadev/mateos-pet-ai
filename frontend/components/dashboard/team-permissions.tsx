"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";

type Props = {
  member: { id: string; role: string; accessPermissions?: string[] };
  activeModules?: string[];
  onSaved: (permissions: string[]) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
};
const permissionKey = (values: string[]) => [...new Set(values)].sort().join(",");

export function TeamPermissions({ member, activeModules, onSaved, onDirtyChange, onSavingChange }: Props) {
  const [selected, setSelected] = useState(member.accessPermissions ?? []);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), tenant = useTenant();
  const dirty = member.role !== "admin" && permissionKey(selected) !== permissionKey(member.accessPermissions ?? []);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(busy); return () => onSavingChange?.(false); }, [busy, onSavingChange]);
  if (member.role === "admin") return <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">Administrador: acceso completo a las áreas habilitadas, Caja y configuración del equipo.</p>;

  async function save() {
    if (lock.current || !dirty) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(proxyUrl("/api/dashboard/staff/" + member.id + "/access" + tenantQuery(tenant)), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessPermissions: selected }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(response.status === 503 ? "El servidor de datos no está disponible. Conservamos tus cambios; intenta de nuevo." : payload?.error ?? "No se pudieron guardar los permisos.");
      if (!Array.isArray(payload?.accessPermissions)) throw new Error("No se confirmó el guardado de los permisos.");
      await onSaved(payload.accessPermissions);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron guardar los permisos."); }
    finally { lock.current = false; setBusy(false); }
  }
  const areaEnabled = (area: string) => !activeModules || activeModules.includes(area);
  const options = [
    { id: "cash", label: "Caja operativa", detail: "Cobrar y revisar movimientos de hoy; sin egresos, comisiones ni reportes generales.", enabled: true },
    { id: "appointment_price", label: "Ajustar precio de una cita", detail: "Solo citas abiertas; las tarifas del catálogo y de futuras visitas siguen a cargo del administrador.", enabled: areaEnabled("veterinary") || areaEnabled("grooming") },
  ];
  if (["vet", "groomer"].includes(member.role)) options.push({ id: "inventory_consume", label: "Registrar insumos utilizados", detail: "Descontar unidades de su área en una atención o con un motivo. No permite modificar costos, precios, entradas ni ajustes.", enabled: areaEnabled(member.role === "vet" ? "veterinary" : "grooming") });
  return <fieldset className="space-y-4 rounded-xl border bg-muted/30 p-4"><legend className="px-2 text-sm font-semibold">Permisos adicionales</legend>
    {options.map(option => {
      const implicit = member.role === "receptionist" && option.id === "cash";
      return <label key={option.id} className="flex items-start gap-3 text-sm">
        <input className="mt-1 h-4 w-4 shrink-0 accent-teal-700" type="checkbox" checked={implicit || selected.includes(option.id)} disabled={busy || implicit || !option.enabled} onChange={event => { setError(""); setSelected(values => event.target.checked ? [...values, option.id] : values.filter(value => value !== option.id)); }} />
        <span><span className="font-semibold">{option.label}{implicit ? " · incluida en Recepción" : ""}</span><span className="mt-1 block text-muted-foreground">{option.detail}{!option.enabled ? " Su área está deshabilitada en el establecimiento." : ""}</span></span>
      </label>;
    })}
    <Button disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar permisos"}</Button>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </fieldset>;
}
