"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { proxyUrl } from "@/lib/api";
import { type TodayAppointment } from "@/lib/appointments";
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
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />
    </div>
  );
}

type NewAction = { type: string; dueAt: string; notes: string };
const EMPTY_ACTION: NewAction = { type: "control", dueAt: "", notes: "" };

export function VetRecordSheet({ appointment, open, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<VetRecord>(EMPTY);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (!open) return;
    let cancelled = false;

    void (async () => {
      if (!cancelled) setLoading(true);
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
        }

        if (!cancelled && actionsRes.ok) {
          const actions = await actionsRes.json();
          setExistingActions(Array.isArray(actions) ? actions : []);
        }
      } catch {
        // ignore — form stays empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, appointment.id]);

  function handleOpenChange(next: boolean) {
    if (!next && dirtyRef.current && !saved) {
      if (!window.confirm("Hay cambios sin guardar. ¿Salir de todas formas?")) return;
    }
    onOpenChange(next);
  }

  async function handleSave() {
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
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <span>{getPetEmoji(appointment.petType)}</span>
            <span>Atención de {appointment.petName}</span>
          </SheetTitle>
          <SheetDescription>
            {appointment.clientName ?? appointment.clientPhone} ·{" "}
            {appointment.serviceName ?? appointment.serviceType}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <div className="space-y-4 px-1 py-4">
            {/* Profesional */}
            {staff.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Profesional responsable
                </label>
                <select
                  value={form.staffId}
                  onChange={(e) => set("staffId")(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Sin asignar</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <Textarea label="Motivo de consulta" value={form.reason} onChange={set("reason")} placeholder="¿Por qué vino la mascota?" />
            <Textarea label="Hallazgos" value={form.findings} onChange={set("findings")} placeholder="Examen físico, observaciones…" rows={3} />
            <Textarea label="Diagnóstico" value={form.diagnosis} onChange={set("diagnosis")} placeholder="Diagnóstico principal…" />
            <Textarea label="Tratamiento" value={form.treatment} onChange={set("treatment")} placeholder="Medicamentos, procedimientos…" rows={3} />
            <Textarea label="Recomendaciones" value={form.recommendations} onChange={set("recommendations")} placeholder="Cuidados en casa, dieta…" />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Peso actual (kg)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="ej. 8.5"
                  value={form.weight}
                  onChange={(e) => set("weight")(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Próximo control recomendado</label>
                <Input
                  type="date"
                  value={form.nextControlAt}
                  onChange={(e) => set("nextControlAt")(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {saved && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
                Atención guardada correctamente.
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Guardando…" : "Guardar atención"}
              </Button>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cerrar
              </Button>
            </div>

            {/* PRÓXIMAS ACCIONES */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Próximas acciones pendientes
              </p>

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
                  disabled={addingAction || !newAction.dueAt}
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
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
