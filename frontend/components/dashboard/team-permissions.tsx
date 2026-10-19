"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { TeamPermissionFields } from './team-permission-fields';

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
  return <div className="space-y-4">
    <TeamPermissionFields role={member.role} selected={selected} onChange={values => { setError(''); setSelected(values); }} activeModules={activeModules} disabled={busy} />
    <Button disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar permisos"}</Button>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </div>;
}
