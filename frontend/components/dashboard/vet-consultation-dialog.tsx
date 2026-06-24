"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
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
  date: new Date().toISOString().slice(0, 10),
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

export function VetConsultationDialog({ open, onOpenChange, petId, petName, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<ConsultForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  function set(field: keyof ConsultForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleClose() {
    setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) });
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.reason.trim() && !form.findings.trim() && !form.diagnosis.trim()) {
      toast("Completa al menos el motivo, hallazgos o diagnóstico.", "error");
      return;
    }

    const dateLabel = form.date
      ? new Date(form.date + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })
      : new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });

    setSaving(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/pets/${petId}/records`), {
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
      toast("Consulta registrada.", "success");
      handleClose();
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al guardar consulta", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <span>🩺</span>
            <span>Historia clínica — {petName}</span>
          </DialogTitle>
          <DialogDescription>
            Registra los datos de la consulta veterinaria
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5">
          {/* Fila 1: Fecha + Peso + Veterinario */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Fecha *</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Peso (kg)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej. 4.5"
                value={form.weight}
                onChange={(e) => set("weight", e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Médico veterinario</label>
              <Input
                placeholder="Nombre del veterinario"
                value={form.veterinarian}
                onChange={(e) => set("veterinarian", e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Anamnesis / Motivo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Anamnesis / Motivo de consulta</label>
            <p className="text-xs text-muted-foreground">
              Historia del paciente, síntomas reportados por el propietario, antecedentes relevantes
            </p>
            <textarea
              rows={5}
              placeholder="Paciente es traído a consulta porque… Alimentación, vacunación, comportamiento, síntomas previos…"
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              disabled={saving}
              className={TEXTAREA}
            />
          </div>

          {/* Hallazgos clínicos */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Hallazgos clínicos / Examen físico</label>
            <p className="text-xs text-muted-foreground">
              Temperatura, frecuencia cardiaca, mucosas, palpación, observaciones del examen
            </p>
            <textarea
              rows={4}
              placeholder="T°: 38.5 C, FC: 100 lpm, mucosas rosadas, abdomen sin dolor a palpación…"
              value={form.findings}
              onChange={(e) => set("findings", e.target.value)}
              disabled={saving}
              className={TEXTAREA}
            />
          </div>

          {/* Diagnóstico */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Diagnóstico diferencial</label>
            <textarea
              rows={3}
              placeholder="Diagnósticos diferenciales considerados, diagnóstico presuntivo o definitivo…"
              value={form.diagnosis}
              onChange={(e) => set("diagnosis", e.target.value)}
              disabled={saving}
              className={TEXTAREA}
            />
          </div>

          {/* Tratamiento */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tratamiento y medicación</label>
            <textarea
              rows={4}
              placeholder="Medicamentos aplicados, dosis, vía de administración, duración del tratamiento…"
              value={form.treatment}
              onChange={(e) => set("treatment", e.target.value)}
              disabled={saving}
              className={TEXTAREA}
            />
          </div>

          {/* Recomendaciones */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Recomendaciones al propietario</label>
            <textarea
              rows={3}
              placeholder="Cuidados en casa, alimentación, restricciones de actividad, señales de alarma…"
              value={form.recommendations}
              onChange={(e) => set("recommendations", e.target.value)}
              disabled={saving}
              className={TEXTAREA}
            />
          </div>

          {/* Próximo control */}
          <div className="space-y-1.5 max-w-xs">
            <label className="text-sm font-medium">Fecha de próximo control</label>
            <Input
              type="date"
              value={form.nextControlAt}
              onChange={(e) => set("nextControlAt", e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar consulta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
