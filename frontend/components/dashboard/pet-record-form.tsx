"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type QuickRecordKind = "vaccine" | "deworming" | "allergy" | "note";
export type QuickRecordForm = { type: string; title: string; date: string; detail: string };
const LABELS: Record<QuickRecordKind, { title: string; placeholder: string; date: string; detail: string; hint: string; next?: string }> = {
  vaccine: { title: "Nombre de la vacuna", placeholder: "Ej. Vacuna antirrábica", date: "Fecha de aplicación", detail: "Laboratorio, lote y observaciones", hint: "Registra los datos de la vacuna aplicada. La próxima fecha es opcional.", next: "Próxima vacunación" },
  deworming: { title: "Producto aplicado", placeholder: "Nombre del desparasitante", date: "Fecha de aplicación", detail: "Dosis, vía de aplicación y observaciones", hint: "Deja constancia del producto utilizado y las indicaciones del profesional.", next: "Próxima desparasitación" },
  allergy: { title: "Sustancia o alergia registrada", placeholder: "Sustancia que se identificó", date: "Fecha del registro", detail: "Reacción y observaciones", hint: "Este registro aparecerá en el resumen de alergias de la mascota." },
  note: { title: "Título de la nota", placeholder: "Ej. Observaciones de la visita", date: "Fecha de la observación", detail: "Observaciones", hint: "Puedes escribir o pegar varias líneas. El registro quedará en el historial de esta mascota." },
};

export function PetRecordForm({ id, kind, petName, form, nextDate, saving, error, onChange, onNextDate, onSubmit }: {
  id: string; kind: QuickRecordKind; petName: string; form: QuickRecordForm; nextDate: string; saving: boolean; error: string | null;
  onChange: (field: "title" | "date" | "detail", value: string) => void; onNextDate: (value: string) => void; onSubmit: (event: FormEvent) => void;
}) {
  const labels = LABELS[kind];
  const [submitted, setSubmitted] = useState(false);
  const titleError = submitted && !form.title.trim();
  const nextError = Boolean(submitted && form.date && nextDate && nextDate < form.date);
  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!form.title.trim() || (form.date && nextDate && nextDate < form.date)) return;
    onSubmit(event);
  }
  return <form id={id} onSubmit={submit} noValidate className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
    <div><h3 className="text-lg font-semibold">Nuevo registro de {petName}</h3><p className="mt-1 max-w-prose text-sm text-muted-foreground">{labels.hint}</p></div>
    <fieldset disabled={saving} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor={`${id}-title`} className="text-sm font-semibold">{labels.title} <span className="text-muted-foreground">(obligatorio)</span></label>
        <Input id={`${id}-title`} value={form.title} onChange={(e) => onChange("title", e.target.value)} placeholder={labels.placeholder} autoFocus required aria-invalid={titleError} aria-describedby={titleError ? `${id}-title-error` : undefined} />
        {titleError && <p id={`${id}-title-error`} role="alert" className="text-sm text-destructive">Completa {labels.title.toLowerCase()}.</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2"><label htmlFor={`${id}-date`} className="text-sm font-semibold">{labels.date}</label><Input id={`${id}-date`} type="date" value={form.date} onInput={(e) => onChange("date", e.currentTarget.value)} onChange={(e) => onChange("date", e.target.value)} /><p className="text-xs text-muted-foreground">Opcional. Si la omites, el historial usará la fecha de registro.</p></div>
        {labels.next && <div className="space-y-2"><label htmlFor={`${id}-next`} className="text-sm font-semibold">{labels.next} (opcional)</label><Input id={`${id}-next`} type="date" value={nextDate} onInput={(e) => onNextDate(e.currentTarget.value)} onChange={(e) => onNextDate(e.target.value)} aria-invalid={nextError} aria-describedby={nextError ? `${id}-next-error` : undefined} />{nextError && <p id={`${id}-next-error`} role="alert" className="text-sm text-destructive">La próxima fecha debe ser igual o posterior a la aplicación.</p>}</div>}
      </div>
      <div className="space-y-2"><label htmlFor={`${id}-detail`} className="text-sm font-semibold">{labels.detail} (opcional)</label><Textarea id={`${id}-detail`} rows={6} value={form.detail} onChange={(e) => onChange("detail", e.target.value)} placeholder="Escribe aquí los detalles que el equipo debe conservar…" className="min-h-40" /></div>
    </fieldset>
    {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
  </form>;
}
