"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ClipboardList, Stethoscope } from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
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
import { VetPatientContext } from "@/components/dashboard/vet-patient-context";
import { VetRecordRevisions } from "@/components/dashboard/vet-record-revisions";
import { tenantQuery, useTenant } from "@/lib/use-tenant";

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

type StaffOption = { id: string; name: string; role: string; email?: string | null };
type RecordMeta = { id: string; version: number; createdAt: string; updatedAt: string; createdByStaffName: string | null; updatedByStaffName: string | null };

function VetRecordSummary({ record, meta, professional, actions, onManageFollowup }: { record: VetRecord; meta: RecordMeta | null; professional: string; actions: PetNextAction[]; onManageFollowup?: () => void }) {
  const sections = [
    ["Motivo de consulta", record.reason],
    ["Hallazgos y examen físico", record.findings],
    ["Diagnóstico", record.diagnosis],
    ["Tratamiento", record.treatment],
    ["Recomendaciones", record.recommendations],
  ];
  return (
    <section aria-label="Resumen de la consulta guardada" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h3 className="font-bold text-slate-950">Consulta registrada</h3>
        <p className="mt-1 text-sm text-slate-600">{professional}{record.weight ? ` · ${record.weight} kg` : ""}{record.nextControlAt ? ` · Control: ${record.nextControlAt}` : ""}</p>
      </div>
      <dl className="divide-y divide-slate-100 px-5">
        {sections.map(([label, value]) => <div key={label} className="py-3"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-900">{value || "Sin registrar"}</dd></div>)}
      </dl>
      {actions.length > 0 && <div className="border-t border-slate-200 px-5 py-3"><h4 className="text-xs font-semibold text-slate-500">Próximas acciones pendientes</h4><ul className="mt-2 space-y-1 text-sm text-slate-800">{actions.map((action) => <li key={action.id}>{NEXT_ACTION_TYPES.find((item) => item.value === action.type)?.label ?? action.type} · {new Date(action.dueAt).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}</li>)}</ul></div>}
      {onManageFollowup && <div className="border-t border-slate-200 px-5 py-3"><button type="button" onClick={onManageFollowup} className="text-sm font-semibold text-teal-700 hover:underline">Agregar o gestionar seguimiento</button></div>}
      {meta && <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600">
        <p>Creado: {formatColombiaDateTime(meta.createdAt)} · {meta.createdByStaffName ?? "Autor individual no registrado"}</p>
        <p className="mt-1">Última edición: {formatColombiaDateTime(meta.updatedAt)} · {meta.updatedByStaffName ?? "Editor individual no registrado"}</p>
      </div>}
    </section>
  );
}

type Props = {
  appointment: TodayAppointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  preview?: boolean;
  readOnly?: boolean;
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

export function VetRecordSheet({ appointment, open, onOpenChange, onSaved, preview = false, readOnly = false }: Props) {
  const { toast } = useToast();
  const { data: session } = useSession();
  const tenant = useTenant();
  const clinicianId = session?.user?.role === "vet" ? session.user.staffId : null;
  const adminEmail = session?.user?.role !== "vet" ? session?.user?.email?.trim().toLowerCase() : null;
  const staffInputId = useId();
  const weightInputId = useId();
  const controlInputId = useId();
  const actionTypeId = useId();
  const actionDateId = useId();
  const actionNotesId = useId();
  const correctionId = useId();
  const [form, setForm] = useState<VetRecord>(EMPTY);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordLoadFailed, setRecordLoadFailed] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [recordMeta, setRecordMeta] = useState<RecordMeta | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const dirtyRef = useRef(false);
  const [formDirty, setFormDirty] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [exitRequested, setExitRequested] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [controlAppointments, setControlAppointments] = useState<TodayAppointment[]>([]);
  const [controlLoading, setControlLoading] = useState(false);
  const [controlError, setControlError] = useState(false);
  const [savedControlAt, setSavedControlAt] = useState("");

  // next actions
  const [existingActions, setExistingActions] = useState<PetNextAction[]>([]);
  const [newAction, setNewAction] = useState<NewAction>(EMPTY_ACTION);
  const [addingAction, setAddingAction] = useState(false);
  const [dismissingActionId, setDismissingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionDirty = newAction.type !== EMPTY_ACTION.type || Boolean(newAction.dueAt || newAction.notes.trim());
  const busy = saving || addingAction || Boolean(dismissingActionId);

  function jumpToSection(key: string) {
    const section = sectionRefs.current[key];
    const scroller = scrollRef.current;
    if (section && scroller) {
      scroller.scrollTo({ top: scroller.scrollTop + section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16, behavior: "auto" });
    }
    section?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open || preview || readOnly) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !actionDirty && !busy) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || (!dirtyRef.current && !actionDirty && !busy)) return;
      if (busy || !window.confirm("Hay cambios sin guardar. ¿Salir de todas formas?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
    };
  }, [open, preview, readOnly, actionDirty, busy]);

  useEffect(() => {
    if (!open || preview || !savedControlAt || !hasRecord) return;
    let cancelled = false;
    const params = new URLSearchParams({ date: savedControlAt });
    if (tenant) params.set("tenantId", tenant);
    void (async () => {
      setControlLoading(true);
      setControlError(false);
      setControlAppointments([]);
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/appointments/week?${params}`), { cache: "no-store" });
        if (!response.ok) throw new Error("appointments");
        const payload = await response.json() as { appointments?: TodayAppointment[] };
        if (!Array.isArray(payload.appointments)) throw new Error("appointments");
        const matches = payload.appointments.filter((item) => item.petId === appointment.petId && item.id !== appointment.id && !["cancelled", "no_show"].includes(item.status) && new Date(item.date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) === savedControlAt);
        if (!cancelled) setControlAppointments(matches);
      } catch {
        if (!cancelled) setControlError(true);
      } finally {
        if (!cancelled) setControlLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, preview, savedControlAt, hasRecord, appointment.id, appointment.petId, tenant]);

  const set = (key: keyof VetRecord) => (value: string) => {
    dirtyRef.current = true;
    setFormDirty(true);
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
      setForm({ ...EMPTY, staffId: clinicianId ?? appointment.staffId ?? "" });
      setHasRecord(false);
      setViewMode(false);
      setRecordMeta(null);
      setCorrectionReason("");
      setSavedControlAt("");
      setSaved(false);
      setExistingActions([]);
      setNewAction(EMPTY_ACTION);
      setActionError(null);
      setError(null);
      setFollowupOpen(false);
      setExitRequested(false);
      setFormDirty(false);
      dirtyRef.current = false;
      try {
        const [staffRes, recordRes, actionsRes] = await Promise.all([
          fetch(proxyUrl(`/api/dashboard/staff${tenantQuery(tenant)}`), { cache: "no-store" }),
          fetch(proxyUrl(`/api/dashboard/appointments/${appointment.id}/medical-record${tenantQuery(tenant)}`), {
            cache: "no-store",
          }),
          fetch(proxyUrl(`/api/dashboard/pets/${appointment.petId}/next-actions${tenantQuery(tenant)}`), {
            cache: "no-store",
          }),
        ]);

        if (!cancelled && staffRes.ok) {
          const data = await staffRes.json();
          const vets = Array.isArray(data) ? data.filter((s: StaffOption) => s.role === "vet") as StaffOption[] : [];
          setStaff(vets);
          if (adminEmail) {
            const ownProfile = vets.filter((s) => s.email?.trim().toLowerCase() === adminEmail);
            if (ownProfile.length === 1) setForm((current) => current.staffId ? current : { ...current, staffId: ownProfile[0].id });
          }
        }

        if (!cancelled && recordRes.ok) {
          const rec = await recordRes.json() as Omit<VetRecord, "weight" | "nextControlAt"> & RecordMeta & { weight: number | null; nextControlAt: string | null };
          setHasRecord(true);
          setViewMode(true);
          setRecordMeta({ id: rec.id, version: rec.version ?? 1, createdAt: rec.createdAt, updatedAt: rec.updatedAt, createdByStaffName: rec.createdByStaffName, updatedByStaffName: rec.updatedByStaffName });
          setSavedControlAt(rec.nextControlAt ? rec.nextControlAt.slice(0, 10) : "");
          setForm({
            reason: rec.reason ?? "",
            findings: rec.findings ?? "",
            diagnosis: rec.diagnosis ?? "",
            treatment: rec.treatment ?? "",
            recommendations: rec.recommendations ?? "",
            weight: rec.weight != null ? String(rec.weight) : "",
            nextControlAt: rec.nextControlAt ? rec.nextControlAt.slice(0, 10) : "",
            staffId: clinicianId ?? rec.staffId ?? appointment.staffId ?? "",
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
  }, [open, appointment.id, appointment.petId, appointment.staffId, clinicianId, adminEmail, preview, tenant]);

  function handleOpenChange(next: boolean) {
    if (!next && busy) return;
    if (!next && !preview && (dirtyRef.current || actionDirty)) {
      setExitRequested(true);
      return;
    }
    onOpenChange(next);
  }

  async function handleSave() {
    if (preview || readOnly || recordLoadFailed) return;
    if (!hasRecord && ![form.reason, form.findings, form.diagnosis, form.treatment, form.recommendations].some((value) => value.trim())) {
      setError("Completa al menos un campo de la evaluación, diagnóstico o plan antes de guardar.");
      return;
    }
    if (staff.length > 0 && !form.staffId) {
      setError("Selecciona al profesional responsable de la consulta.");
      return;
    }
    if (form.weight && (!Number.isFinite(Number(form.weight)) || Number(form.weight) <= 0)) {
      setError("El peso debe ser un número mayor que cero.");
      return;
    }
    if (hasRecord && appointment.status === "completed" && (correctionReason.trim().length < 5 || correctionReason.trim().length > 1000)) {
      setError("Indica el motivo de la corrección de esta consulta finalizada (entre 5 y 1000 caracteres).");
      return;
    }
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
        staffId: clinicianId ?? (form.staffId || null),
        expectedVersion: hasRecord ? recordMeta?.version ?? 1 : null,
        correctionReason: correctionReason.trim() || null,
      };
      const res = await fetch(
        proxyUrl(`/api/dashboard/appointments/${appointment.id}/medical-record${tenantQuery(tenant)}`),
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
      const savedRecord = await res.json() as RecordMeta;
      setRecordMeta(savedRecord);
      setCorrectionReason("");
      setSavedControlAt(form.nextControlAt);
      dirtyRef.current = false;
      setFormDirty(false);
      setSaved(true);
      setHasRecord(true);
      setViewMode(true);
      setFollowupOpen(actionDirty);
      onSaved?.();
      toast("Historia clínica guardada para esta consulta.", "success");
      // El guardado puede crear o actualizar automáticamente el próximo control.
      void fetch(proxyUrl(`/api/dashboard/pets/${appointment.petId}/next-actions${tenantQuery(tenant)}`), { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return;
          const actions = await response.json();
          if (Array.isArray(actions)) setExistingActions(actions);
        })
        .catch(() => {});
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

        {!loading && !viewMode && !readOnly && <nav aria-label="Secciones de la historia clínica" className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-5 py-2 sm:px-8">
          {[{ key: "datos", label: "Datos" }, { key: "evaluacion", label: "Evaluación" }, { key: "plan", label: "Diagnóstico y plan" }, { key: "seguimiento", label: "Seguimiento" }].map((section) => <button type="button" key={section.key} onClick={() => jumpToSection(section.key)} className="min-h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">{section.label}</button>)}
        </nav>}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-6 sm:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {preview && (
              <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                Vista de ejemplo. Puedes explorar el formato, pero no se guardarán cambios.
              </p>
            )}

            {appointment.petId && <VetPatientContext petId={appointment.petId} appointmentId={appointment.id} preview={preview} />}

            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Cargando historia de esta consulta…</div>
            ) : (<>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ClipboardList className="size-4 text-teal-700" aria-hidden="true" />
              {hasRecord ? "Registro guardado de esta consulta" : "Nuevo registro para esta consulta"}
            </div>
            {hasRecord && appointment.status === "completed" && !viewMode && !readOnly && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-950">Corrección de una consulta finalizada · Versión {recordMeta?.version ?? 1}</p>
              <p className="text-xs text-amber-900">La versión anterior se conservará junto con tu identidad, la fecha y el motivo del cambio. Una nueva visita debe registrarse en una cita nueva.</p>
              <label htmlFor={correctionId} className="block text-sm font-semibold text-slate-800">Motivo de la corrección</label>
              <textarea id={correctionId} rows={2} maxLength={1000} value={correctionReason} disabled={saving} onChange={(event) => { setCorrectionReason(event.target.value); dirtyRef.current = true; setFormDirty(true); setSaved(false); }} placeholder="Explica por qué necesitas corregir este registro…" className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm" />
            </div>}

            {readOnly && !hasRecord ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">Esta consulta todavía no tiene una historia registrada. Pide al administrador que te asigne la atención si necesitas registrarla.</p> : hasRecord && viewMode ? (
              <VetRecordSummary record={form} meta={recordMeta} professional={staff.find((item) => item.id === form.staffId)?.name ?? appointment.staffName ?? "Profesional sin asignar"} actions={existingActions.filter((item) => item.sourceAppointmentId === appointment.id || Boolean(recordMeta?.id && item.sourceRecordId === recordMeta.id))} onManageFollowup={readOnly ? undefined : () => { setFollowupOpen(true); requestAnimationFrame(() => jumpToSection("seguimiento")); }} />
            ) : (<fieldset disabled={readOnly || saving} className="contents">

            <section ref={(node) => { sectionRefs.current.datos = node; }} tabIndex={-1} aria-labelledby="consulta-datos" className="space-y-4 border-b border-slate-200 px-1 pb-7 focus:outline-none">
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
                  disabled={Boolean(clinicianId)}
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
                  min="0.1"
                  placeholder="ej. 8.5"
                  value={form.weight}
                  onChange={(e) => set("weight")(e.target.value)}
                />
                </div>
              </div>
            </section>

            <section ref={(node) => { sectionRefs.current.evaluacion = node; }} tabIndex={-1} aria-labelledby="consulta-evaluacion" className="space-y-4 border-b border-slate-200 px-1 pb-7 focus:outline-none">
              <div className="flex items-start gap-3">
                <Stethoscope className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" />
                <div><h3 id="consulta-evaluacion" className="text-base font-bold text-slate-950">Evaluación clínica</h3><p className="mt-1 text-sm text-slate-500">Deja constancia de lo que motivó la consulta y lo observado durante el examen.</p></div>
              </div>
              <Textarea label="Motivo de consulta" value={form.reason} onChange={set("reason")} placeholder="Síntomas y motivo relatado por el responsable…" rows={3} />
              <Textarea label="Hallazgos y examen físico" value={form.findings} onChange={set("findings")} placeholder="Hallazgos del examen, signos y observaciones…" rows={4} />
            </section>

            <section ref={(node) => { sectionRefs.current.plan = node; }} tabIndex={-1} aria-labelledby="consulta-plan" className="space-y-4 border-b border-slate-200 px-1 pb-7 focus:outline-none">
              <div><h3 id="consulta-plan" className="text-base font-bold text-slate-950">Diagnóstico y plan</h3><p className="mt-1 text-sm text-slate-500">Documenta la conclusión y las indicaciones que quedarán en la historia.</p></div>
              <Textarea label="Diagnóstico" value={form.diagnosis} onChange={set("diagnosis")} placeholder="Diagnóstico o impresión clínica…" rows={3} />
              <Textarea label="Tratamiento" value={form.treatment} onChange={set("treatment")} placeholder="Procedimientos, medicamentos o tratamiento indicado…" rows={4} />
              <Textarea label="Recomendaciones para el responsable" value={form.recommendations} onChange={set("recommendations")} placeholder="Cuidados en casa, alimentación y signos de alerta…" rows={3} />
            </section>

            </fieldset>)}
            {hasRecord && recordMeta && appointment.petId && <VetRecordRevisions key={recordMeta.id} petId={appointment.petId} recordId={recordMeta.id} version={recordMeta.version} />}
            {(!viewMode || followupOpen) && !(readOnly && !hasRecord) && <section ref={(node) => { sectionRefs.current.seguimiento = node; }} tabIndex={-1} aria-labelledby="consulta-seguimiento" className="space-y-4 rounded-xl bg-slate-50/60 px-4 py-4 focus:outline-none">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" />
                <div><h3 id="consulta-seguimiento" className="text-base font-bold text-slate-950">Seguimiento</h3><p className="mt-1 text-sm text-slate-500">Indica cuándo revisar la evolución y qué acciones quedan pendientes.</p></div>
              </div>
              {!viewMode && <fieldset disabled={readOnly || saving} className="space-y-2 sm:max-w-xs">
                <label htmlFor={controlInputId} className="text-sm font-semibold text-slate-800">Próximo control recomendado</label>
                <Input
                  id={controlInputId}
                  type="date"
                  value={form.nextControlAt}
                  onChange={(e) => set("nextControlAt")(e.target.value)}
                />
              </fieldset>}
              {hasRecord && savedControlAt && <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
                <p className="font-semibold">Control recomendado: {new Date(`${savedControlAt}T12:00:00Z`).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}</p>
                <p className="mt-1 text-xs">La recomendación no reserva una cita. Estas son las citas existentes de la mascota para esa fecha; confirma cuál corresponde al control.</p>
                {controlLoading ? <p role="status" className="mt-2 text-xs">Comprobando agenda…</p> : controlError ? <p role="alert" className="mt-2 text-xs text-amber-900">No se pudo comprobar la agenda. No podemos confirmar si existe una cita.</p> : controlAppointments.length > 0 ? <ul className="mt-2 space-y-1 text-xs">{controlAppointments.map((item) => <li key={item.id}>{item.serviceName ?? item.serviceType} · {formatColombiaDateTime(item.date)}</li>)}</ul> : <p className="mt-2 text-xs font-semibold">Sin citas registradas para esa fecha. Solicita su agendamiento.</p>}
              </div>}
            <fieldset disabled={readOnly || busy || loading || recordLoadFailed} className="border-t border-slate-100 pt-5 space-y-3">
              <legend className="sr-only">Gestionar seguimientos</legend>
              <p className="text-sm font-semibold text-slate-800">Seguimientos de esta consulta</p>
              <p className="text-xs text-slate-500">{hasRecord ? "Cada acción se guarda por separado al pulsar “Agregar acción”." : "Guarda primero la historia clínica para registrar sus acciones de seguimiento."}</p>
              {actionError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{actionError}</p>}

              {/* existing pending actions */}
              {existingActions.some((item) => item.sourceAppointmentId === appointment.id || Boolean(recordMeta?.id && item.sourceRecordId === recordMeta.id)) && (
                <ul className="space-y-1">
                  {existingActions.filter((item) => item.sourceAppointmentId === appointment.id || Boolean(recordMeta?.id && item.sourceRecordId === recordMeta.id)).map((a) => {
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
                        {a.notes && <span className="mx-3 flex-1 whitespace-pre-wrap text-xs text-slate-600">{a.notes}</span>}
                        <button
                          type="button"
                          disabled={dismissingActionId === a.id}
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                          onClick={async () => {
                            setDismissingActionId(a.id);
                            setActionError(null);
                            try {
                              const response = await fetch(proxyUrl(`/api/dashboard/next-actions/${a.id}${tenantQuery(tenant)}`), {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "dismissed" }),
                              });
                              if (!response.ok) {
                                const payload = await response.json().catch(() => null);
                                throw new Error(payload?.error ?? "No se pudo descartar la acción.");
                              }
                              setExistingActions((prev) => prev.filter((x) => x.id !== a.id));
                            } catch (err) {
                              setActionError(err instanceof Error ? err.message : "No se pudo descartar la acción.");
                            } finally {
                              setDismissingActionId(null);
                            }
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
                    <label htmlFor={actionTypeId} className="text-xs font-medium text-muted-foreground">Tipo de seguimiento</label>
                    <select
                      id={actionTypeId}
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
                    <label htmlFor={actionDateId} className="text-xs font-medium text-muted-foreground">Fecha estimada</label>
                    <Input
                      id={actionDateId}
                      type="date"
                      value={newAction.dueAt}
                      onChange={(e) => setNewAction((a) => ({ ...a, dueAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor={actionNotesId} className="text-xs font-medium text-muted-foreground">Notas (opcional)</label>
                  <Input
                    id={actionNotesId}
                    placeholder="Indicaciones adicionales…"
                    value={newAction.notes}
                    onChange={(e) => setNewAction((a) => ({ ...a, notes: e.target.value }))}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={preview || addingAction || !newAction.dueAt || !hasRecord}
                  onClick={async () => {
                    setAddingAction(true);
                    setActionError(null);
                    try {
                      const res = await fetch(
                        proxyUrl(`/api/dashboard/pets/${appointment.petId}/next-actions${tenantQuery(tenant)}`),
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
                      toast("Seguimiento agregado a esta consulta.", "success");
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
            </fieldset>
            </section>}
            </>)}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-8">
          {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          {recordLoadFailed && <p role="alert" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">No se pudo comprobar el registro de esta consulta. Cierra y vuelve a abrir antes de guardar.</p>}
          {saved && <p role="status" className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">La atención quedó guardada en la historia de esta consulta.</p>}
          {!preview && (formDirty || actionDirty) && <p role="status" className="mb-2 text-xs font-medium text-amber-800">{formDirty ? "Hay cambios en la historia sin guardar." : "Hay una acción de seguimiento sin agregar."} {actionDirty && formDirty ? "También tienes una acción sin agregar." : ""}</p>}
          <div className="mx-auto flex max-w-3xl flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">El registro se vincula a esta cita y podrás consultarlo en la historia de la mascota.</p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>Cerrar</Button>
              {readOnly ? null : hasRecord && viewMode ? <Button onClick={() => { setViewMode(false); setSaved(false); }} disabled={preview || busy}>Editar registro</Button> : <Button onClick={handleSave} disabled={loading || busy || preview || recordLoadFailed}>
                {preview ? "Vista de ejemplo" : saving ? "Guardando…" : hasRecord && appointment.status === "completed" ? "Guardar corrección" : hasRecord ? "Guardar cambios" : "Guardar consulta"}
              </Button>}
            </div>
          </div>
        </div>
      </DialogContent>
      <Dialog open={exitRequested} onOpenChange={setExitRequested}>
        <DialogContent role="alertdialog" showClose={false} className="max-w-md border-slate-200 bg-white p-6 text-slate-950">
          <DialogHeader className="border-0 p-0">
            <DialogTitle>¿Cerrar sin guardar?</DialogTitle>
            <DialogDescription>Hay cambios pendientes en la historia o una acción de seguimiento sin agregar. Si cierras, se perderán esos cambios.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setExitRequested(false)}>Seguir editando</Button>
            <Button onClick={() => { dirtyRef.current = false; setExitRequested(false); onOpenChange(false); }}>Descartar y cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
