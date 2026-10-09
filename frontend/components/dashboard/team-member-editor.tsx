"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WEEK_DAYS } from "@/lib/business-hours-editor";
import { availabilityError, memberFormError, suggestedStaffWeek, TEAM_ROLES, type Availability, type StaffMember, type TimeWindow } from "@/lib/team-editor";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";

export type EditorSignals = { onDirtyChange: (dirty: boolean) => void; onSavingChange: (saving: boolean) => void; onCanSaveChange?: (ready: boolean) => void };
export async function teamRequest(path: string, tenant: string | null, method: string, body?: unknown) {
  const response = await fetch(proxyUrl(path + tenantQuery(tenant)), { method, cache: "no-store", ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 503 ? "El servidor de datos no está disponible. Conservamos tus cambios; intenta de nuevo." : payload?.error ?? "No se pudo completar la acción. Intenta de nuevo.");
  return payload;
}
function useSignals(dirty: boolean, busy: boolean, { onDirtyChange, onSavingChange }: EditorSignals) {
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange(busy); return () => onSavingChange(false); }, [busy, onSavingChange]);
}
export function MemberEditor({ member, onSaved, ...signals }: EditorSignals & { member?: StaffMember; onSaved: (member: StaffMember) => void }) {
  const initial = { name: member?.name ?? "", role: member?.role ?? "vet", phone: member?.phone ?? "", email: member?.email ?? "" };
  const [form, setForm] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), tenant = useTenant(), dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useSignals(dirty, busy, signals);
  async function save(event: React.FormEvent) {
    event.preventDefault(); const invalid = memberFormError(form); if (invalid) { setError(invalid); return; }
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const result = await teamRequest("/api/dashboard/staff" + (member ? "/" + member.id : ""), tenant, member ? "PATCH" : "POST", { name: form.name.trim(), role: form.role, phone: form.phone.trim() || null, email: form.email.trim() || null });
      if (!result?.id) throw new Error("La respuesta no confirmó el guardado. Actualiza el equipo antes de intentarlo de nuevo.");
      onSaved({ ...member, ...result });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la ficha."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-5"><fieldset disabled={busy} className="space-y-4">
    <label className="block space-y-1.5 text-sm font-semibold">Nombre del integrante<Input required maxLength={200} value={form.name} onChange={e => { setError(""); setForm({ ...form, name: e.target.value }); }} autoComplete="name" /></label>
    <label className="block space-y-1.5 text-sm font-semibold">Perfil<select className="h-11 w-full rounded-xl border border-input bg-background px-3 font-normal" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{TEAM_ROLES.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
    <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{TEAM_ROLES.find(role => role.value === form.role)?.description}</p>
    <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-semibold">Teléfono (opcional)<Input type="tel" value={form.phone} maxLength={40} onChange={e => setForm({ ...form, phone: e.target.value })} /></label><label className="space-y-1.5 text-sm font-semibold">Correo de contacto (opcional)<Input type="email" maxLength={254} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label></div>
    <p className="text-sm text-muted-foreground">La ficha identifica al integrante en las atenciones. Su cuenta de ingreso se configura en Acceso.</p>
  </fieldset>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}<Button type="submit" disabled={busy || (member ? !dirty : !form.name.trim())}>{busy ? "Guardando…" : member ? "Guardar ficha" : "Crear integrante"}</Button></form>;
}
export function StaffScheduleEditor({ member, businessHours, onSaved, ...signals }: EditorSignals & { member: StaffMember; businessHours: unknown; onSaved: (member: StaffMember) => void }) {
  const [av, setAv] = useState<Availability | null>(member.availability), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), tenant = useTenant(), dirty = JSON.stringify(av) !== JSON.stringify(member.availability), invalid = availabilityError(av);
  useSignals(dirty, busy, signals);
  const onCanSaveChange = signals.onCanSaveChange;
  useEffect(() => { onCanSaveChange?.(dirty && !invalid && !busy); return () => onCanSaveChange?.(false); }, [dirty, invalid, busy, onCanSaveChange]);
  function working(key:string,active:boolean) { setError("");setAv(prev=>({...prev,[key]:{...(prev?.[key] ?? suggestedStaffWeek(businessHours,member.role)[key]),active}})); }
  function changeWindows(key:string,windows:TimeWindow[]) { setError("");setAv(prev=>({...prev,[key]:{...(prev?.[key] ?? suggestedStaffWeek(businessHours,member.role)[key]),open:windows[0]?.open ?? '',close:windows[windows.length-1]?.close ?? '',windows}})); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (invalid || lock.current) return; lock.current = true; setBusy(true); setError("");
    try { const result = await teamRequest("/api/dashboard/staff/" + member.id, tenant, "PATCH", { availability: av }); if (!result?.id) throw new Error("No se confirmó el guardado del horario."); onSaved({ ...member, ...result }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el horario."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form id={`staff-schedule-${member.id}`} onSubmit={save} className="space-y-5"><div className="space-y-2 text-sm text-muted-foreground"><p>Horario semanal individual, en hora de Colombia. Las citas existentes se conservan.</p><p>Agenda comprueba este horario y las ausencias al asignar un profesional. Después de guardar se abrirá la revisión de citas afectadas.</p></div><fieldset disabled={busy} className="space-y-4">
    <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={av !== null} onChange={e => setAv(e.target.checked ? suggestedStaffWeek(businessHours, member.role) : null)} className="h-4 w-4 accent-teal-700" />Personalizar horario del integrante</label>
    {av === null ? <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">Sin restricción semanal individual. La agenda mantiene el horario del establecimiento y del área.</p> : <div className="divide-y rounded-xl border">{WEEK_DAYS.map(({ key, label }) => {
      const day = av[key] ?? { active: false, open: "", close: "" };
      const windows = day.windows ?? [{open:day.open,close:day.close}];
      return <section key={key} aria-label={`Jornada ${label}`} className="space-y-3 p-4"><label className="flex items-center gap-2 text-sm font-semibold"><input aria-label={`Trabaja el ${label.toLocaleLowerCase("es")}`} type="checkbox" checked={day.active} onChange={e => working(key,e.target.checked)} className="h-4 w-4 accent-teal-700" />{label}{!day.active && <span className="font-normal text-muted-foreground">Libre</span>}</label>{day.active && <><p className="text-xs text-muted-foreground">Los descansos entre franjas quedan fuera de su disponibilidad.</p>{windows.map((window,index)=><div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="space-y-1 text-xs font-medium">Entrada · franja {index+1}<Input aria-label={`Entrada ${label} franja ${index+1}`} type="time" step="60" value={window.open} onInput={e=>changeWindows(key,windows.map((w,i)=>i===index?{...w,open:e.currentTarget.value}:w))} onChange={e=>changeWindows(key,windows.map((w,i)=>i===index?{...w,open:e.target.value}:w))} /></label><label className="space-y-1 text-xs font-medium">Salida · franja {index+1}<Input aria-label={`Salida ${label} franja ${index+1}`} type="time" step="60" value={window.close} onInput={e=>changeWindows(key,windows.map((w,i)=>i===index?{...w,close:e.currentTarget.value}:w))} onChange={e=>changeWindows(key,windows.map((w,i)=>i===index?{...w,close:e.target.value}:w))} /></label><Button type="button" variant="outline" size="sm" aria-label={`Quitar franja ${index+1} ${label}`} onClick={()=>changeWindows(key,windows.filter((_,i)=>i!==index))}>Quitar franja</Button></div>)}<Button type="button" size="sm" variant="outline" disabled={windows.length>=8} onClick={()=>changeWindows(key,[...windows,{open:'',close:''}])}>Agregar franja</Button></>}</section>;
    })}</div>}
  </fieldset>{(error || invalid) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error || invalid}</p>}<Button type="button" variant="outline" disabled={busy || !dirty} onClick={() => { setAv(member.availability); setError(""); }}>Deshacer cambios</Button></form>;
}
export function StaffAccessEditor({ member, onSaved, onRevoke, ...signals }: EditorSignals & { member: StaffMember; onSaved: (member: StaffMember) => void; onRevoke: () => void }) {
  const [email, setEmail] = useState(member.credential?.email ?? member.email ?? ""), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), tenant = useTenant();
  useSignals(email !== (member.credential?.email ?? member.email ?? "") || password !== "", busy, signals);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 12 || password.length > 128) { setError("Escribe un correo válido y una contraseña de 12 a 128 caracteres."); return; }
    lock.current = true; setBusy(true); setError("");
    try { const credential = await teamRequest(`/api/dashboard/staff/${member.id}/credential`, tenant, "PUT", { email: email.trim(), password }); setPassword(""); onSaved({ ...member, credential }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el acceso."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-5"><p className="text-sm text-muted-foreground">Esta cuenta usa el perfil y los permisos de {member.name}. Cada respuesta de WhatsApp identifica a su autor.</p>{!member.active && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Activa al integrante para habilitar su ingreso.</p>}<fieldset disabled={busy || !member.active} className="space-y-4"><label className="block space-y-1.5 text-sm font-semibold">Correo de ingreso<Input type="email" required maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label><label className="block space-y-1.5 text-sm font-semibold">{member.credential?.active ? "Nueva contraseña" : "Contraseña inicial"}<Input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="De 12 a 128 caracteres" /></label><p className="text-sm text-muted-foreground">Al actualizar el acceso, las sesiones anteriores deberán iniciar sesión de nuevo.</p></fieldset>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}<div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || !member.active || !password}>{busy ? "Guardando…" : member.credential?.active ? "Actualizar acceso" : "Habilitar acceso"}</Button>{member.credential?.active && <Button type="button" variant="outline" disabled={busy} onClick={onRevoke}>Revocar acceso</Button>}</div></form>;
}
