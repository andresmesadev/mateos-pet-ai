"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarClock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import type { StaffMember } from "@/lib/team-editor";
import { teamRequest, type EditorSignals } from "./team-member-editor";

type Affected = { id: string; date: string; petName: string; ownerName: string | null; serviceName: string; serviceId: string | null; serviceType: string; reason: string };
type Absence = { id: string; type: string; startAt: string; endAt: string; reason: string | null; voidedAt?: string | null; voidReason?: string | null; voidedBy?: string | null; replacement?: { id: string } | null; replacesId?: string | null };
type Review = { absences: Absence[]; affected: Affected[]; multipleIntervals: boolean };
const dateLabel = (date: string) => new Date(date).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
function appointmentParts(date: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(date)).map(part => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function TeamAvailability({ member, preview = false, onDirtyChange, onSavingChange }: { member: StaffMember; preview?: boolean } & Partial<EditorSignals>) {
  const tenant = useTenant();
  const [review, setReview] = useState<Review | null>(null), [error, setError] = useState(""), [version, setVersion] = useState(0), [busy, setBusy] = useState(false);
  const [type, setType] = useState("planned_absence"), [start, setStart] = useState(""), [end, setEnd] = useState(""), [reason, setReason] = useState(""), [notice, setNotice] = useState("");
  const [replacement, setReplacement] = useState<{ appointment: Affected; choices: { id: string; name: string }[]; selected: string } | null>(null);
  const [change, setChange] = useState<{ absence: Absence; action: 'correct' | 'void'; start: string; end: string; reason: string; changeReason: string } | null>(null);
  const lock = useRef(false), dirty = Boolean(start || end || reason || replacement?.selected || change);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(busy); return () => onSavingChange?.(false); }, [busy, onSavingChange]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return null;
      setReview(null); setError("");
      return fetch(proxyUrl(`/api/dashboard/staff/${member.id}/availability-review${tenantQuery(tenant)}`), { signal: controller.signal, cache: "no-store" });
    }).then(async res => {
      if (!res || controller.signal.aborted) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la disponibilidad.");
      if (!controller.signal.aborted) setReview(data);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar la disponibilidad."); });
    return () => controller.abort();
  }, [member.id, tenant, version]);

  async function saveAbsence(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    const a = new Date(`${start}:00-05:00`), b = new Date(`${end}:00-05:00`);
    if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || a >= b) { setError("Selecciona inicio y fin válidos; el fin debe ser posterior al inicio."); return; }
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await teamRequest(`/api/dashboard/staff/${member.id}/absences`, tenant, "POST", { type, startAt: a.toISOString(), endAt: b.toISOString(), reason: reason.trim() || null });
      setStart(""); setEnd(""); setReason(""); setNotice("Ausencia guardada. Revisa abajo las citas que necesitan un reemplazo."); setVersion(v => v + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la ausencia."); }
    finally { lock.current = false; setBusy(false); }
  }
  function beginChange(absence: Absence, action: 'correct' | 'void') {
    const a = appointmentParts(absence.startAt), b = appointmentParts(absence.endAt);
    setError(''); setNotice('');
    setChange({ absence, action, start: `${a.date}T${a.time}`, end: `${b.date}T${b.time}`, reason: absence.reason || '', changeReason: '' });
  }
  async function saveChange(event: FormEvent) {
    event.preventDefault(); if (!change || lock.current) return;
    const a = new Date(`${change.start}:00-05:00`), b = new Date(`${change.end}:00-05:00`);
    if (!change.changeReason.trim()) { setError('Indica el motivo del cambio.'); return; }
    if (change.action === 'correct' && (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || a >= b)) { setError('El fin debe ser posterior al inicio.'); return; }
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await teamRequest(`/api/dashboard/staff/${member.id}/absences/${change.absence.id}/change`, tenant, 'POST', { action: change.action, changeReason: change.changeReason.trim(), ...(change.action === 'correct' ? { range: { startAt: a.toISOString(), endAt: b.toISOString(), reason: change.reason.trim() || null } } : {}) });
      setChange(null); setNotice('Cambio guardado. El antecedente se conserva y las citas se revisaron con la disponibilidad actual.'); setVersion(v => v + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cambio.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function findReplacement(appointment: Affected) {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ ...appointmentParts(appointment.date), appointmentId: appointment.id, serviceType: appointment.serviceType, ...(appointment.serviceId ? { serviceId: appointment.serviceId } : {}) });
      const res = await fetch(proxyUrl(`/api/dashboard/staff/available?${params}${tenantQuery(tenant).replace("?", "&")}`), { cache: "no-store" });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "No se pudo buscar un reemplazo.");
      setReplacement({ appointment, choices: data.filter((s: { id: string }) => s.id !== member.id), selected: "" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo buscar un reemplazo."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function reassign() {
    if (!replacement?.selected || lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      await teamRequest(`/api/dashboard/appointments/${replacement.appointment.id}`, tenant, "PATCH", { staffId: replacement.selected });
      setReplacement(null); setNotice("Cita reasignada. La reserva y sus datos se conservaron."); setVersion(v => v + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo reasignar la cita."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="space-y-5">
    {review?.multipleIntervals && <p className="rounded-xl border bg-muted/30 p-4 text-sm">El horario tiene varias franjas por día. Los espacios entre ellas no están disponibles para atender.</p>}
    {!preview && <form onSubmit={saveAbsence} className="space-y-4 rounded-2xl border p-4 sm:p-5"><h3 className="font-semibold">Registrar ausencia</h3><p className="text-sm text-muted-foreground">Indica cuándo no podrá atender. Las reservas existentes se conservan y las nuevas asignaciones se bloquean en ese rango. Horas de Bogotá.</p><fieldset disabled={busy} className="space-y-4">
      <label className="block space-y-1.5 text-sm font-semibold">Tipo de ausencia<select value={type} onChange={e => setType(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-3"><option value="planned_absence">Programada · vacaciones, permiso u otro</option><option value="unplanned_absence">Imprevista · enfermedad u otra novedad</option></select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-semibold">Inicio de ausencia<Input type="datetime-local" step={60} value={start} onChange={e => setStart(e.target.value)} required /></label><label className="space-y-1.5 text-sm font-semibold">Fin de ausencia<Input type="datetime-local" step={60} value={end} onChange={e => setEnd(e.target.value)} required /></label></div>
      <label className="block space-y-1.5 text-sm font-semibold">Motivo <span className="font-normal text-muted-foreground">(opcional)</span><Input maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej. permiso personal" /></label><Button type="submit" disabled={busy || !start || !end}><CalendarClock aria-hidden="true" />{busy ? "Guardando…" : "Guardar ausencia"}</Button>
    </fieldset></form>}
    {error && <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{!review && <Button variant="outline" onClick={() => setVersion(v => v + 1)} disabled={busy}>Reintentar</Button>}</div>}
    {notice && <p role="status" className="rounded-xl bg-primary/10 p-4 text-sm text-primary">{notice}</p>}
    {!review && !error && <p role="status" className="text-sm text-muted-foreground">Consultando ausencias y reservas…</p>}
    {review && <><section className="space-y-3"><header className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Citas por revisar <span className="text-muted-foreground">({review.affected.length})</span></h3><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setVersion(v => v + 1)}><RefreshCw aria-hidden="true" />Actualizar</Button></header><p className="text-sm text-muted-foreground">Reservas futuras que no cumplen la disponibilidad actual. Las atenciones iniciadas y el historial cerrado se conservan.</p>
      {review.affected.length === 0 ? <p className="rounded-xl border bg-muted/20 p-4 text-sm">No hay citas que requieran revisión con la disponibilidad actual.</p> : <ul className="space-y-3">{review.affected.map(a => <li key={a.id} className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-4"><p className="font-semibold">{a.petName} · {a.ownerName || "Propietario sin nombre"}</p><p className="text-sm text-muted-foreground">{a.serviceName} · {dateLabel(a.date)}</p><p className="text-sm text-amber-900">{a.reason}</p>{!preview && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => void findReplacement(a)}>Buscar reemplazo</Button><Button variant="outline" size="sm" asChild><Link href={`/dashboard/calendar?date=${appointmentParts(a.date).date}${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`}>Abrir en Agenda</Link></Button></div>}</li>)}</ul>}
      {replacement && <div className="space-y-3 rounded-xl border p-4"><p className="font-semibold">Reasignar la cita de {replacement.appointment.petName}</p>{replacement.choices.length ? <label className="block space-y-1.5 text-sm">Profesional disponible<select className="h-11 w-full rounded-xl border bg-background px-3" value={replacement.selected} disabled={busy} onChange={e => setReplacement({ ...replacement, selected: e.target.value })}><option value="">Selecciona un reemplazo</option>{replacement.choices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label> : <p className="text-sm text-muted-foreground">No hay reemplazos disponibles para este servicio y horario. Abre Agenda para gestionar otra fecha.</p>}<div className="flex flex-wrap gap-2"><Button disabled={busy || !replacement.selected} onClick={() => void reassign()}>Confirmar reasignación</Button><Button variant="outline" disabled={busy} onClick={() => setReplacement(null)}>Cancelar</Button></div></div>}
    </section>{!preview && <section className="space-y-3"><h3 className="font-semibold">Ausencias e historial <span className="text-muted-foreground">({review.absences.length})</span></h3>{review.absences.length === 0 ? <p className="text-sm text-muted-foreground">Sin ausencias registradas.</p> : <ul className="space-y-3">{review.absences.map(a => <li key={a.id} className="space-y-2 rounded-xl border p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{a.type === "planned_absence" ? "Ausencia programada" : "Ausencia imprevista"}</p><span className={a.voidedAt ? "text-muted-foreground" : "font-semibold text-primary"}>{a.voidedAt ? (a.replacement ? "Corregida · antecedente" : "Anulada") : "Vigente"}</span></div><p className="text-muted-foreground">{dateLabel(a.startAt)} — {dateLabel(a.endAt)}</p>{a.reason && <p className="break-words">{a.reason}</p>}{a.replacesId && <p className="text-xs text-muted-foreground">Reemplaza una ausencia corregida.</p>}{a.voidedAt ? <p className="break-words text-xs text-muted-foreground">{a.voidReason} · {a.voidedBy} · {dateLabel(a.voidedAt)}. Este antecedente no bloquea la agenda.</p> : <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy || !!change} onClick={() => beginChange(a, 'correct')}>Corregir ausencia</Button><Button variant="outline" size="sm" disabled={busy || !!change} onClick={() => beginChange(a, 'void')}>Anular ausencia</Button></div>}{change?.absence.id === a.id && <form onSubmit={saveChange} className="space-y-4 rounded-xl bg-muted/20 p-4"><h4 className="font-semibold">{change.action === 'correct' ? 'Corregir ausencia' : 'Anular ausencia'}</h4><p className="text-muted-foreground">{change.action === 'correct' ? 'El registro original se conservará y será reemplazado por este nuevo rango.' : 'Dejará de bloquear horarios. Se conservarán el antecedente y las reservas existentes.'}</p><fieldset disabled={busy} className="space-y-4">{change.action === 'correct' && <><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-1.5">Nuevo inicio<Input required type="datetime-local" step={60} value={change.start} onChange={e => setChange({ ...change, start: e.target.value })} /></label><label className="block space-y-1.5">Nuevo fin<Input required type="datetime-local" step={60} value={change.end} onChange={e => setChange({ ...change, end: e.target.value })} /></label></div><label className="block space-y-1.5">Motivo de la ausencia<Input maxLength={1000} value={change.reason} onChange={e => setChange({ ...change, reason: e.target.value })} /></label></>}<label className="block space-y-1.5 font-semibold">Motivo del cambio<Input required maxLength={1000} value={change.changeReason} onChange={e => setChange({ ...change, changeReason: e.target.value })} placeholder="Ej. fecha registrada por error" /></label><div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || !change.changeReason.trim()}>{busy ? 'Guardando…' : change.action === 'correct' ? 'Guardar corrección' : 'Confirmar anulación'}</Button><Button type="button" variant="outline" onClick={() => setChange(null)}>Cancelar cambio</Button></div></fieldset></form>}</li>)}</ul>}</section>}</>}
  </div>;
}
