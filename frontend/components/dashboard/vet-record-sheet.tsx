"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ClipboardList, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { proxyUrl } from "@/lib/api";
import { formatColombiaDateTime, type TodayAppointment } from "@/lib/appointments";
import { getPetEmoji, NEXT_ACTION_TYPES, type PetNextAction } from "@/lib/pets";

type VetRecord = {
  reason: string;
  findings: string;
  diagnosis: string;
  treatment: string;
  recommendations: string;
  weight: string;
  nextControlAt: string;
  staffId: string;
};

const EMPTY: VetRecord = {
  reason: "",
  findings: "",
  diagnosis: "",
  treatment: "",
  recommendations: "",
  weight: "",
  nextControlAt: "",
  staffId: "",
};

type StaffOption = { id: string; name: string; role: string };

type Props = {
  appointment: TodayAppointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  preview?: boolean;
};

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
      />
    </div>
  );
}

type NewAction = { type: string; dueAt: string; notes: string };
const EMPTY_ACTION: NewAction = { type: "control", dueAt: "", notes: "" };

export function VetRecordSheet({ appointment, open, onOpenChange, onSaved, preview = false }: Props) {
  const staffInputId = useId();
  const weightInputId = useId();
  const controlInputId = useId();
  const [form, setForm] = useState<VetRecord>(EMPTY);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordLoadFailed, setRecordLoadFailed] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);
  const dirtyRef = useRef(false);

  // next actions
  const [existingActions, setExistingActions] = useState<PetNextAction[]>([]);
  const [newAction, setNewAction] = useState<NewAction>(EMPTY_ACTION);
  const [addingAction, setAddingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const set = (key: keyof VetRecord) => (value: string) => {
    dirtyRef.current = true;
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Load staff list and existing record when sheet opens
  useEffect(() => {
    if (!open || preview) return;
    let cancelled = false;

    void (async () => {
      if (!cancelled) setLoading(true);
      if (!cancelled) setRecordLoadFailed(false);
      setForm(EMPTY);
      setHasRecord(false);
      setSaved(false);
      setExistingActions([]);
      dirtyRef.current = false;
      try {
        const [staffRes, recordRes, actionsRes] = await Promise.all([
          fetch(proxyUrl("/api/dashboard/staff"), { cache: "no-store" }),
          fetch(proxyUrl(`/api/dashboard/appointments/${appointment.id}/medical-record`), {
            cache: "no-store",
          }),
          fetch(proxyUrl(`/api/dashboard/pets/${appointment.petId}/next-actions`), {
            cache: "no-store",
          }),
        ]);

        if (!cancelled && staffRes.ok) {
          const data = await staffRes.json();
          setStaff(
            Array.isArray(data)
              ? data.filter((s: StaffOption) => s.role === "vet")
              : []
          );
        }

        if (!cancelled && recordRes.ok) {
          const rec = await recordRes.json();
          setHasRecord(true);
          setForm({
            reason: rec.reason ?? "",
            findings: rec.findings ?? "",
            diagnosis: rec.diagnosis ?? "",
            treatment: rec.treatment ?? "",
            recommendations: rec.recommendations ?? "",
            weight: rec.weight != null ? String(rec.weight) : "",
            nextControlAt: rec.nextControlAt ? rec.nextControlAt.slice(0, 10) : "",
            staffId: rec.staffId ?? "",
          });
          dirtyRef.current = false;
        } else if (!cancelled && recordRes.status !== 404) {
          setRecordLoadFailed(true);
        }

        if (!cancelled && actionsRes.ok) {
          const actions = await actionsRes.json();
          setExistingActions(Array.isArray(actions) ? actions : []);
        }
      } catch {
        if (!cancelled) setRecordLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, appointment.id, appointment.petId, preview]);

  function handleOpenChange(next: boolean) {
    if (!next && !preview && dirtyRef.current && !saved) {
      if (!window.confirm("Hay cambios sin guardar. ¿Salir de todas formas?")) return;
    }
    onOpenChange(next);
  }

  async function handleSave() {
    if (preview || recordLoadFailed) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string | number | null> = {
        reason: form.reason.trim() || null,
        findings: form.findings.trim() || null,
        diagnosis: form.diagnosis.trim() || null,
        treatment: form.treatment.trim() || null,
        recommendations: form.recommendations.trim() || null,
        weight: form.weight ? Number(form.weight) : null,
        nextControlAt: form.nextControlAt || null,
        staffId: form.staffId || null,
      };
      const res = await fetch(
        proxyUrl(`/api/dashboard/appointments/${appointment.id}/medical-record`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Error al guardar");
      }
      dirtyRef.current = false;
      setSaved(true);
      setHasRecord(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(92dvh,960px)] w-[calc(100vw-24px)] max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl">
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 pr-14 sm:px-8 sm:py-6 sm:pr-14">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-2xl" aria-hidden="true">{getPetEmoji(appointment.petType)}</span>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Historia clínica de {appointment.petName}</DialogTitle>
              <DialogDescription className="mt-1 text-sm">Registro de esta consulta veterinaria</DialogDescription>
            </div>
          </div>
          <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm sm:grid-cols-3">
            <div><span className="block text-xs text-slate-500">Responsable</span><span className="font-semibold text-slate-800">{appointment.clientName || appointment.clientPhone || "Sin nombre"}</span></div>
            <div><span className="block text-xs text-slate-500">Servicio</span><span className="font-semibold text-slate-800">{appointment.serviceName || appointment.serviceType}</span></div>
            <div><span className="block text-xs text-slate-500">Fecha de la consulta</span><span className="font-semibold text-slate-800">{formatColombiaDateTime(appointment.date)}</span></div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-6 sm:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {preview && (
              <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                Vista de ejemplo. Puedes explorar el formato, pero no se guardarán cambios.
              </p>
            )}

            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Cargando historia de esta consulta…</div>
            ) : (<>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ClipboardList className="size-4 text-teal-700" aria-hidden="true" />
              {hasRecord ? "Registro guardado de esta consulta" : "Nuevo registro para esta consulta"}
            </div>

            <section aria-labelledby="consulta-datos" className="space-y-4 border-b border-slate-200 px-1 pb-7">
              <div>
                <h3 id="consulta-datos" className="text-base font-bold text-slate-950">Datos de la atención</h3>
                <p className="mt-1 text-sm text-slate-500">Identifica al profesional y registra la medición de hoy.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor={staffInputId} className="text-sm font-semibold text-slate-800">Profesional responsable</label>
                <select
                  id={staffInputId}
                  value={form.staffId}
                  onChange={(e) => set("staffId")(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">Sin asignar</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                </div>
                <div className="space-y-2">
                <label htmlFor={weightInputId} className="text-sm font-semibold text-slate-800">Peso actual (kg)</label>
                <Input
                  id={weightInputId}
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="ej. 8.5"
                  value={form.weight}
                  onChange={(e) => set("weight")(e.target.value)}
                />
                </div>
              </div>
            </section>

            <section aria-labelledby="consulta-evaluacion" className="space-y-4 border-b border-slate-200 px-1 pb-7">
              <div className="flex items-start gap-3">
                <Stethoscope className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" />
                <div><h3 id="consulta-evaluacion" className="text-base font-bold text-slate-950">Evaluación clínica</h3><p className="mt-1 text-sm text-slate-500">Deja constancia de lo que motivó la consulta y lo observado durante el examen.</p></div>
              </div>
              <Textarea label="Motivo de consulta" value={form.reason} onChange={set("reason")} placeholder="Síntomas y motivo relatado por el responsable…" rows={3} />
              <Textarea label="Hallazgos y examen físico" value={form.findings} onChange={set("findings")} placeholder="Hallazgos del examen, signos y observaciones…" rows={4} />
            </section>

            <section aria-labelledby="consulta-plan" className="space-y-4 border-b border-slate-200 px-1 pb-7">
              <div><h3 id="consulta-plan" className="text-base font-bold text-slate-950">Diagnóstico y plan</h3><p className="mt-1 text-sm text-slate-500">Documenta la conclusión y las indicaciones que quedarán en la historia.</p></div>
              <Textarea label="Diagnóstico" value={form.diagnosis} onChange={set("diagnosis")} placeholder="Diagnóstico o impresión clínica…" rows={3} />
              <Textarea label="Tratamiento" value={form.treatment} onChange={set("treatment")} placeholder="Procedimientos, medicamentos o tratamiento indicado…" rows={4} />
              <Textarea label="Recomendaciones para el responsable" value={form.recommendations} onChange={set("recommendations")} placeholder="Cuidados en casa, alimentación y signos de alerta…" rows={3} />
            </section>

            <section aria-labelledby="consulta-seguimiento" className="space-y-4 px-1 pb-4">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" />
                <div><h3 id="consulta-seguimiento" className="text-base font-bold text-slate-950">Seguimiento</h3><p className="mt-1 text-sm text-slate-500">Indica cuándo revisar la evolución y qué acciones quedan pendientes.</p></div>
              </div>
              <div className="space-y-2 sm:max-w-xs">
                <label htmlFor={controlInputId} className="text-sm font-semibold text-slate-800">Próximo control recomendado</label>
                <Input
                  id={controlInputId}
                  type="date"
                  value={form.nextControlAt}
                  onChange={(e) => set("nextControlAt")(e.target.value)}
                />
              </div>
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <p className="text-sm font-semibold text-slate-800">Próximas acciones pendientes</p>
              <p className="text-xs text-slate-500">Cada acción se guarda por separado al pulsar “Agregar acción”.</p>

              {/* existing pending actions */}
              {existingActions.length > 0 && (
                <ul className="space-y-1">
                  {existingActions.map((a) => {
                    const meta = NEXT_ACTION_TYPES.find((t) => t.value === a.type);
                    return (
                      <li key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span>
                          {meta?.icon ?? "📋"} {meta?.label ?? a.type}
                          {a.dueAt && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              · {new Date(a.dueAt).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </span>
                        <button
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                          onClick={async () => {
                            try {
                              await fetch(proxyUrl(`/api/dashboard/next-actions/${a.id}`), {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "dismissed" }),
                              });
                              setExistingActions((prev) => prev.filter((x) => x.id !== a.id));
                            } catch { /* noop */ }
                          }}
                        >
                          Descartar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* add new action form */}
              <div className="rounded-lg border border-dashed p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                    <select
                      value={newAction.type}
                      onChange={(e) => setNewAction((a) => ({ ...a, type: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {NEXT_ACTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Fecha estimada</label>
                    <Input
                      type="date"
                      value={newAction.dueAt}
                      onChange={(e) => setNewAction((a) => ({ ...a, dueAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Notas (opcional)</label>
                  <Input
                    placeholder="Indicaciones adicionales…"
                    value={newAction.notes}
                    onChange={(e) => setNewAction((a) => ({ ...a, notes: e.target.value }))}
                  />
                </div>
                {actionError && (
                  <p className="text-xs text-destructive">{actionError}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={preview || addingAction || !newAction.dueAt}
                  onClick={async () => {
                    setAddingAction(true);
                    setActionError(null);
                    try {
                      const res = await fetch(
                        proxyUrl(`/api/dashboard/pets/${appointment.petId}/next-actions`),
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            type: newAction.type,
                            dueAt: newAction.dueAt,
                            notes: newAction.notes.trim() || null,
                            sourceAppointmentId: appointment.id,
                          }),
                        }
                      );
                      if (!res.ok) {
                        const p = await res.json().catch(() => null);
                        throw new Error(p?.error ?? "Error al agregar acción");
                      }
                      const created = await res.json() as PetNextAction;
                      setExistingActions((prev) => [...prev, created]);
                      setNewAction(EMPTY_ACTION);
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : "Error al agregar");
                    } finally {
                      setAddingAction(false);
                    }
                  }}
                >
                  {addingAction ? "Agregando…" : "+ Agregar acción"}
                </Button>
              </div>
            </div>
            </section>
            </>)}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-8">
          {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          {recordLoadFailed && <p role="alert" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">No se pudo comprobar el registro de esta consulta. Cierra y vuelve a abrir antes de guardar.</p>}
          {saved && <p role="status" className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">La atención quedó guardada en la historia de esta consulta.</p>}
          <div className="mx-auto flex max-w-3xl flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">El registro se vincula a esta cita y podrás consultarlo en la historia de la mascota.</p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cerrar</Button>
              <Button onClick={handleSave} disabled={loading || saving || preview || recordLoadFailed}>
                {preview ? "Vista de ejemplo" : saving ? "Guardando…" : hasRecord ? "Guardar cambios" : "Guardar consulta"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
