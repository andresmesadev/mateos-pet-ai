"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ProtectedDialog, useDialogEditGuard } from "@/components/dashboard/protected-dialog";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { proxyUrl } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  petId: string;
  petName: string;
  onSaved: () => void;
};

type ConsultForm = {
  date: string;
  weight: string;
  veterinarian: string;
  reason: string;
  findings: string;
  diagnosis: string;
  treatment: string;
  recommendations: string;
  nextControlAt: string;
};

const EMPTY: ConsultForm = {
  date: "",
  weight: "",
  veterinarian: "",
  reason: "",
  findings: "",
  diagnosis: "",
  treatment: "",
  recommendations: "",
  nextControlAt: "",
};

const TEXTAREA =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:cursor-not-allowed disabled:opacity-50";

function VetConsultationContent({ petId, petName, onSaved, onClose }: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const tenant = useTenant();
  const id = useId();
  const [initialDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }));
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [form, setForm] = useState<ConsultForm>(() => ({ ...EMPTY, date: initialDate }));
  const [saving, setSaving] = useState(false);

  const dirty = (Object.keys(form) as (keyof ConsultForm)[]).some((field) => form[field] !== (field === "date" ? initialDate : EMPTY[field]));
  const discard = useDialogEditGuard(dirty, saving);
  function set(field: keyof ConsultForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  function handleClose() {
    discard(onClose);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.reason.trim() && !form.findings.trim() && !form.diagnosis.trim()) {
      setError("Completa al menos el motivo, los hallazgos o el diagnóstico del antecedente.");
      return;
    }

    if (form.nextControlAt && form.date && form.nextControlAt < form.date) { setError("El próximo control debe ser igual o posterior a la fecha del antecedente."); return; }
    setError(null);
    const dateLabel = form.date
      ? new Date(form.date + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })
      : new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });

    setSaving(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/pets/${petId}/records${tenantQuery(tenant)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "consultation",
          title: `Consulta veterinaria — ${dateLabel}${form.veterinarian ? ` · ${form.veterinarian}` : ""}`,
          date: form.date || null,
          reason: form.reason || null,
          findings: form.findings || null,
          diagnosis: form.diagnosis || null,
          treatment: form.treatment || null,
          recommendations: form.recommendations || null,
          weight: form.weight ? parseFloat(form.weight) : null,
          nextControlAt: form.nextControlAt || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "No se pudo guardar");
      }
      toast("Antecedente guardado.", "success");
      onClose();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar antecedente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="flex h-[92vh] w-full max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <span>🩺</span>
            <span>Antecedente sin cita — {petName}</span>
          </DialogTitle>
          <DialogDescription>
            Registra una consulta anterior que no tiene cita en la agenda. Para una atención programada, usa Consultas veterinarias.
          </DialogDescription>
        </DialogHeader>

        <form id={id} onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5">
          <fieldset disabled={saving} className="flex flex-col gap-5">
          {/* Fila 1: Fecha + Peso + Veterinario */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor={`${id}-date`} className="text-sm font-semibold">Fecha *</label>
              <Input
                type="date"
                required
                id={`${id}-date`}
                value={form.date}
                onInput={(e) => set("date", e.currentTarget.value)}
                onChange={(e) => set("date", e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-weight`} className="text-sm font-semibold">Peso (kg)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej. 4.5"
                id={`${id}-weight`}
                value={form.weight}
                onChange={(e) => set("weight", e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-veterinarian`} className="text-sm font-semibold">Médico veterinario</label>
              <Input
                placeholder="Nombre del veterinario"
                id={`${id}-veterinarian`}
                value={form.veterinarian}
                onChange={(e) => set("veterinarian", e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Anamnesis / Motivo */}
          <div className="space-y-1.5">
            <label htmlFor={`${id}-reason`} className="text-sm font-semibold">Anamnesis / Motivo de consulta</label>
            <p className="text-xs text-muted-foreground">
              Historia del paciente, síntomas reportados por el propietario, antecedentes relevantes
            </p>
            <textarea
              rows={5}
              placeholder="Paciente es traído a consulta porque… Alimentación, vacunación, comportamiento, síntomas previos…"
              id={`${id}-reason`}
                value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              disabled={saving}
              className={TEXTAREA}
            />
          </div>

          {/* Hallazgos clínicos */}
          <div className="space-y-1.5">
            <label htmlFor={`${id}-findings`} className="text-sm font-semibold">Hallazgos clínicos / Examen físico</label>
            <p className="text-xs text-muted-foreground">
              Temperatura, frecuencia cardiaca, mucosas, palpación, observaciones del examen
            </p>
            <textarea
              rows={4}
              placeholder="T°: 38.5 C, FC: 100 lpm, mucosas rosadas, abdomen sin dolor a palpación…"
              id={`${id}-findings`}
                value={form.findings}
              onChange={(e) => set("findings", e.target.value)}
              disabled={saving}
              className={TEXTAREA}
            />
          </div>

          {/* Diagnóstico */}
          <div className="space-y-1.5">
            <label htmlFor={`${id}-diagnosis`} className="text-sm font-semibold">Diagnóstico diferencial</label>
            <textarea
              rows={3}
              placeholder="Diagnósticos diferenciales considerados, diagnóstico presuntivo o definitivo…"
              id={`${id}-diagnosis`}
                value={form.diagnosis}
              onChange={(e) => set("diagnosis", e.target.value)}
              disabled={saving}
              className={TEXTAREA}
            />
          </div>

          {/* Tratamiento */}
          <div className="space-y-1.5">
            <label htmlFor={`${id}-treatment`} className="text-sm font-semibold">Tratamiento y medicación</label>
            <textarea
              rows={4}
              placeholder="Medicamentos aplicados, dosis, vía de administración, duración del tratamiento…"
              id={`${id}-treatment`}
                value={form.treatment}
              onChange={(e) => set("treatment", e.target.value)}
              disabled={saving}
              className={TEXTAREA}
            />
          </div>

          {/* Recomendaciones */}
          <div className="space-y-1.5">
            <label htmlFor={`${id}-recommendations`} className="text-sm font-semibold">Recomendaciones al propietario</label>
            <textarea
              rows={3}
              placeholder="Cuidados en casa, alimentación, restricciones de actividad, señales de alarma…"
              id={`${id}-recommendations`}
                value={form.recommendations}
              onChange={(e) => set("recommendations", e.target.value)}
              disabled={saving}
              className={TEXTAREA}
            />
          </div>

          {/* Próximo control */}
          <div className="space-y-1.5 max-w-xs">
            <label htmlFor={`${id}-nextControlAt`} className="text-sm font-semibold">Fecha de próximo control</label>
            <Input
              type="date"
              id={`${id}-nextControlAt`}
              value={form.nextControlAt}
              onInput={(e) => set("nextControlAt", e.currentTarget.value)}
              onChange={(e) => set("nextControlAt", e.target.value)}
              disabled={saving}
            />
          </div>

          </fieldset>
          {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
        </form>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-card px-6 py-4">
          <p className="text-sm text-muted-foreground">Antecedente sin cita · {petName}</p>
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button><Button type="submit" form={id} disabled={saving}>{saving ? "Guardando…" : "Guardar antecedente"}</Button></div>
        </footer>
      </DialogContent>
  );
}

export function VetConsultationDialog({ open, onOpenChange, ...props }: Props) {
  return <ProtectedDialog open={open} onOpenChange={onOpenChange}>{open && <VetConsultationContent {...props} onClose={() => onOpenChange(false)} />}</ProtectedDialog>;
}
