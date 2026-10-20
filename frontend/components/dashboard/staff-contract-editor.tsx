"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/lib/use-tenant";
import type { StaffMember } from "@/lib/team-editor";
import { teamRequest, type EditorSignals } from "./team-member-editor";

export function StaffContractEditor({ member, onSaved, onDirtyChange, onSavingChange }: EditorSignals & { member: StaffMember; onSaved: (member: StaffMember) => void }) {
  const field = useId(), tenant = useTenant(), lock = useRef(false);
  const initialType = member.contractType ?? "";
  const initialPercentage = member.commissionRate == null ? "" : String(Number((Number(member.commissionRate) * 100).toFixed(2)));
  const [contractType, setContractType] = useState(initialType);
  const [percentage, setPercentage] = useState(initialPercentage);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const dirty = contractType !== initialType || (contractType === "service" && percentage !== initialPercentage);
  const value = Number(percentage.replace(",", "."));
  const valid = /^\d{1,3}([.,]\d{1,2})?$/.test(percentage.trim()) && Number.isFinite(value) && value >= 0 && value <= 100;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange(busy); return () => onSavingChange(false); }, [busy, onSavingChange]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !dirty) return;
    if (!contractType || (contractType === "service" && !valid)) { setError("Selecciona el contrato e indica un porcentaje entre 0 y 100, con máximo dos decimales."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const saved = await teamRequest(`/api/dashboard/staff/${encodeURIComponent(member.id)}/contract`, tenant, "PUT", { contractType, commissionRate: contractType === "service" ? value / 100 : null });
      if (saved?.id !== member.id || saved.contractType !== contractType) throw new Error("No se pudo confirmar el guardado. Actualiza la ficha antes de repetir.");
      onSaved(saved);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el contrato."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-5" aria-label="Tipo de contrato">
    {!member.contractType && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Sin configurar. Se conserva el reparto actual hasta que guardes el tipo de contrato de esta persona.</p>}
    <fieldset disabled={busy} className="space-y-4">
      <label className="block space-y-2 text-sm font-semibold"><span>Tipo de contrato</span><select className="h-11 w-full rounded-md border bg-background px-3 font-normal" value={contractType} onChange={event => { setContractType(event.target.value as typeof contractType); setError(""); }}><option value="" disabled>Selecciona el tipo de contrato</option><option value="fixed">Fijo</option><option value="service">Prestación de servicios</option></select></label>
      {contractType === "fixed" && <p className="rounded-lg border bg-muted/30 p-4 text-sm">Sin reparto porcentual para este integrante. Su pago fijo se administra aparte.</p>}
      {contractType === "service" && <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-4"><label htmlFor={field} className="block text-sm font-semibold">Porcentaje para el profesional (%)</label><Input id={field} inputMode="decimal" value={percentage} onChange={event => { setPercentage(event.target.value); setError(""); }} placeholder="Ej. 50" required className="h-11 bg-background" /><div className="grid grid-cols-2 gap-3 text-sm"><p>Profesional<br /><strong className="text-lg">{valid ? `${value}%` : "Por definir"}</strong></p><p>Centro<br /><strong className="text-lg">{valid ? `${Number((100 - value).toFixed(2))}%` : "Por definir"}</strong></p></div><p className="text-xs text-muted-foreground">Solo aplica en servicios que tengan activado el reparto por porcentaje. Ambas partes suman 100%.</p></div>}
    </fieldset>
    <p className="text-xs text-muted-foreground">Se usará en nuevas comisiones. Las comisiones y cierres anteriores conservan su porcentaje e importes.</p>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <div className="flex justify-end"><Button type="submit" disabled={!dirty || busy || !contractType || (contractType === "service" && !valid)}>{busy ? "Guardando…" : "Guardar tipo de contrato"}</Button></div>
  </form>;
}
