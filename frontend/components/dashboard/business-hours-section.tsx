"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Copy, Info, Save, Scissors, Stethoscope, Users } from "lucide-react";
import type { BusinessHourDay, DayHours, TenantProfile } from "@/app/dashboard/settings/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AgendaExceptionsManager } from "@/components/dashboard/agenda-exceptions-manager";
import { useToast } from "@/components/ui/toast";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { copyMondayToOpenDays, displayedDay, hoursErrors, hoursPayload, hoursSignature, readHoursDraft, WEEK_DAYS, type HoursDraft, type WeekHours } from "@/lib/business-hours-editor";

type Props = { profile: TenantProfile | null; onDirtyChange?: (dirty: boolean) => void; onSavingChange?: (saving: boolean) => void; onOpenTeam?: () => void };
const AREAS = [{ key: "vet", module: "veterinary", label: "Veterinaria", icon: Stethoscope }, { key: "grooming", module: "grooming", label: "Peluquería", icon: Scissors }] as const;

function WeekEditor({ scope, title, hours, fallback, errors, onChange, onCopy }: {
  scope: string; title: string; hours: WeekHours; fallback?: WeekHours; errors: Record<string, string>;
  onChange: (day: BusinessHourDay, field: keyof DayHours, value: string | boolean) => void; onCopy: () => void;
}) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Apertura y cierre · hora de Colombia</p><Button type="button" variant="outline" size="sm" onClick={onCopy} disabled={!displayedDay("mon", hours, fallback).active}><Copy aria-hidden="true" />Copiar lunes a días abiertos</Button></div>
    <div className="divide-y divide-border rounded-xl border border-border">{WEEK_DAYS.map(({ key, label }) => {
      const day = displayedDay(key, hours, fallback);
      const error = errors[`${scope}-${key}`];
      return <div key={key} className="space-y-2 p-4"><div className="grid items-center gap-3 sm:grid-cols-[minmax(140px,1fr)_140px_140px]">
        <div><label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={day.active} onChange={event => onChange(key, "active", event.target.checked)} aria-label={`${title}: atender el ${label.toLocaleLowerCase("es")}`} className="h-4 w-4 accent-teal-700" />{label}</label><p className="mt-1 text-xs text-muted-foreground">{!day.active ? "Cerrado" : hours[key] ? "Horario configurado" : fallback?.[key] ? "Usa el horario habitual" : "Horario predeterminado"}</p></div>
        <label className="space-y-1 text-xs font-medium"><span>Apertura</span><Input aria-label={`${title}: apertura ${label}`} aria-invalid={!!error} aria-describedby={error ? `${scope}-${key}-error` : undefined} type="time" step="60" value={day.open} disabled={!day.active} onInput={event => onChange(key, "open", event.currentTarget.value)} onChange={event => onChange(key, "open", event.target.value)} /></label>
        <label className="space-y-1 text-xs font-medium"><span>Cierre</span><Input aria-label={`${title}: cierre ${label}`} aria-invalid={!!error} aria-describedby={error ? `${scope}-${key}-error` : undefined} type="time" step="60" value={day.close} disabled={!day.active} onInput={event => onChange(key, "close", event.currentTarget.value)} onChange={event => onChange(key, "close", event.target.value)} /></label>
      </div>{error && <p id={`${scope}-${key}-error`} className="text-sm text-red-800">{error}</p>}</div>;
    })}</div>
  </div>;
}

export function BusinessHoursSection({ profile, onDirtyChange, onSavingChange, onOpenTeam }: Props) {
  const router = useRouter();
  const tenant = useTenant();
  const { toast } = useToast();
  const [draft, setDraft] = useState(() => readHoursDraft(profile?.businessHours));
  const [saved, setSaved] = useState(() => hoursSignature(readHoursDraft(profile?.businessHours)));
  const [saving, setSaving] = useState(false);
  const [exceptionDirty, setExceptionDirty] = useState(false);
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const request = useRef(false);
  const dirty = hoursSignature(draft) !== saved;
  const busy = saving || exceptionSaving;
  const validation = hoursErrors(draft);
  useEffect(() => { onDirtyChange?.(dirty || exceptionDirty); }, [dirty, exceptionDirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(busy); }, [busy, onSavingChange]);
  function update(next: HoursDraft) { setDraft(next); setError(null); setJustSaved(false); }
  function change(scope: "general" | "vet" | "grooming", day: BusinessHourDay, field: keyof DayHours, value: string | boolean) {
    const source = scope === "general" ? draft.general : draft.services[scope] ?? {};
    const next = { ...source, [day]: { ...displayedDay(day, source, scope === "general" ? undefined : draft.general), [field]: value } };
    update(scope === "general" ? { ...draft, general: next } : { ...draft, services: { ...draft.services, [scope]: next } });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current || busy || !dirty) return;
    setShowErrors(true);
    if (Object.keys(validation).length) { setError("Revisa los horarios señalados antes de guardar."); return; }
    request.current = true; setSaving(true); setError(null);
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/tenant/profile${tenantQuery(tenant)}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessHours: hoursPayload(draft) }) });
      const result = await response.json().catch(() => null) as TenantProfile & { error?: string } | null;
      if (!response.ok || !result?.id) throw new Error(response.status === 401 || response.status === 403 ? "Tu sesión no permite guardar estos horarios." : "No se pudieron guardar los horarios. Tus cambios siguen aquí; intenta de nuevo.");
      const confirmed = readHoursDraft(result.businessHours);
      setDraft(confirmed); setSaved(hoursSignature(confirmed)); setJustSaved(true); setShowErrors(false);
      toast("Horario habitual y horarios por área guardados.", "success");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudieron guardar los horarios."); }
    finally { request.current = false; setSaving(false); }
  }
  const teamUrl = `/dashboard/settings?tab=usuarios${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`;
  return <div className="max-w-4xl space-y-6">
    <form onSubmit={save} noValidate className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Horario habitual y horarios por área">
      <header className="flex items-start gap-3 border-b border-border p-5 sm:p-7"><div className="rounded-xl bg-teal-50 p-3 text-primary"><CalendarClock aria-hidden="true" className="h-5 w-5" /></div><div><h2 className="text-xl font-bold">Horario habitual</h2><p className="mt-1 text-sm text-muted-foreground">Define cuándo atiende tu negocio. Cada área puede usar este horario o tener uno propio.</p></div></header>
      <fieldset disabled={busy} className="space-y-6 p-5 sm:p-7">
        <div className="flex gap-3 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground"><Info aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /><p>Puedes indicar horas y minutos, por ejemplo 09:00 o 10:30. Los días sin configurar conservan su horario actual. Las fechas especiales reemplazan el horario habitual para la fecha y el área elegidas. Las citas existentes se conservan.</p></div>
        <WeekEditor scope="general" title="Horario habitual" hours={draft.general} errors={showErrors ? validation : {}} onChange={(day, field, value) => change("general", day, field, value)} onCopy={() => update({ ...draft, general: copyMondayToOpenDays(draft.general) })} />
        <section aria-labelledby="hours-areas-title" className="space-y-4 border-t border-border pt-6"><h3 id="hours-areas-title" className="text-lg font-bold">Horarios por área</h3><p className="text-sm text-muted-foreground">Un horario propio reemplaza al habitual para esa área. Si un día no tiene un horario propio, usa el habitual.</p>
          {AREAS.filter(area => profile?.activeModules.includes(area.module)).map(area => {
            const custom = draft.services[area.key] !== undefined;
            return <section key={area.key} aria-label={`Horario de ${area.label.toLocaleLowerCase("es")}`} className="space-y-4 rounded-xl border border-border p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="flex items-center gap-2 font-semibold"><area.icon aria-hidden="true" className="h-5 w-5 text-primary" />{area.label}</h4><Badge variant="outline">{custom ? "Horario propio" : "Usa el habitual"}</Badge></div><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={custom} className="h-4 w-4 accent-teal-700" onChange={event => { const services = { ...draft.services }; if (event.target.checked) services[area.key] = {}; else delete services[area.key]; update({ ...draft, services }); }} />Configurar horario propio de {area.label.toLocaleLowerCase("es")}</label>{custom && <WeekEditor scope={area.key} title={area.label} hours={draft.services[area.key] ?? {}} fallback={draft.general} errors={showErrors ? validation : {}} onChange={(day, field, value) => change(area.key, day, field, value)} onCopy={() => update({ ...draft, services: { ...draft.services, [area.key]: copyMondayToOpenDays(draft.services[area.key] ?? {}, draft.general) } })} />}</section>;
          })}
          {!profile?.activeModules.some(module => ["veterinary", "grooming"].includes(module)) && <p className="text-sm text-muted-foreground">No hay áreas de atención con citas activadas. Puedes configurar el horario del negocio aquí.</p>}
        </section>
      </fieldset>
      <footer className="space-y-4 border-t border-border bg-muted/20 p-5 sm:px-7">{error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}<div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">{justSaved && <Check aria-hidden="true" className="h-4 w-4 text-primary" />}{saving ? "Guardando horarios…" : dirty ? "Tienes cambios de horario sin guardar." : justSaved ? "Horarios guardados." : "No hay cambios pendientes."}</p><div className="flex flex-wrap gap-2">{dirty && <Button type="button" variant="outline" disabled={busy} onClick={() => { update(JSON.parse(saved) as HoursDraft); setShowErrors(false); }}>Deshacer cambios</Button>}<Button type="submit" disabled={busy || !dirty}><Save aria-hidden="true" />{saving ? "Guardando…" : "Guardar horarios"}</Button></div></div></footer>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5"><div><h3 className="flex items-center gap-2 font-semibold"><Users aria-hidden="true" className="h-4 w-4 text-primary" />Disponibilidad del equipo</h3><p className="mt-1 text-sm text-muted-foreground">Los horarios y las ausencias de cada profesional se gestionan en Equipo y accesos.</p></div><Button type="button" variant="outline" disabled={busy} onClick={onOpenTeam ?? (() => router.push(teamUrl))}>Ver equipo y accesos</Button></div>
    <AgendaExceptionsManager disabled={saving} onDirtyChange={setExceptionDirty} onSavingChange={setExceptionSaving} />
  </div>;
}
