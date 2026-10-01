"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDialogEditGuard } from "@/components/dashboard/protected-dialog";
import { HISTORY_FILTERS, matchesHistory, type HistoryFilter } from "@/lib/contact-profile-utils";
import { consultationHref } from "@/lib/contact-navigation";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import {
  type NextAction,
  type TimelineItem,
  formatRecordDate,
} from "@/lib/pets";
import { formatStatus, statusBadgeClass } from "@/lib/appointments";

// ── Icons / labels per kind ──────────────────────────────────

const KIND_META: Record<string, { icon: string; label: string; color: string }> = {
  consultation: { icon: "🩺", label: "Consulta veterinaria", color: "text-blue-600 dark:text-blue-700" },
  grooming: { icon: "✂️", label: "Peluquería", color: "text-violet-600 dark:text-violet-700" },
  other_appt: { icon: "📅", label: "Cita", color: "text-muted-foreground" },
  vaccine: { icon: "💉", label: "Vacuna", color: "text-green-600 dark:text-green-700" },
  deworming: { icon: "💊", label: "Desparasitación", color: "text-green-600 dark:text-green-700" },
  exam: { icon: "🔬", label: "Examen", color: "text-cyan-600 dark:text-cyan-700" },
  image: { icon: "🩻", label: "Imagen", color: "text-cyan-600 dark:text-cyan-700" },
  treatment: { icon: "🩹", label: "Tratamiento", color: "text-blue-600 dark:text-blue-700" },
  allergy: { icon: "🤧", label: "Alergia", color: "text-orange-600 dark:text-orange-700" },
  note: { icon: "📝", label: "Nota", color: "text-muted-foreground" },
  cancelled: { icon: "✗", label: "Cancelada", color: "text-red-500 dark:text-red-700" },
  no_show: { icon: "✗", label: "No asistió", color: "text-red-500 dark:text-red-700" },
  next_action: { icon: "📌", label: "Control pendiente", color: "text-amber-600 dark:text-amber-700" },
};

function kindMeta(kind: string) {
  return KIND_META[kind] ?? { icon: "📄", label: kind, color: "text-muted-foreground" };
}

// ── Date grouping ────────────────────────────────────────────

function groupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const monthKey = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
    }).format(value);
  const bogotaFmt = (d: Date) =>
    new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "long",
    }).format(d);
  if (monthKey(date) === monthKey(now)) return "Este mes";

  const currentBogotaParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const currentYear = Number(currentBogotaParts.find((part) => part.type === "year")?.value);
  const currentMonth = Number(currentBogotaParts.find((part) => part.type === "month")?.value);
  const previousMonth = new Date(Date.UTC(currentYear, currentMonth - 2, 15, 12));
  if (monthKey(date) === monthKey(previousMonth)) return "Mes anterior";
  return bogotaFmt(date);
}

// ── Clinical detail block ────────────────────────────────────

function ClinicalDetail({ item }: { item: TimelineItem }) {
  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "Motivo / Anamnesis", value: item.reason },
    { label: "Hallazgos clínicos", value: item.findings },
    { label: "Diagnóstico", value: item.diagnosis },
    { label: "Tratamiento", value: item.treatment },
    { label: "Recomendaciones", value: item.recommendations },
  ];
  const hasClinical = fields.some((f) => f.value);
  const hasWeight = item.weight != null;
  const hasNextControl = !!item.nextControlAt;
  const hasDetail = !!item.detail;

  if (!hasClinical && !hasWeight && !hasNextControl && !hasDetail) return null;

  return (
    <div className="mt-2 space-y-1.5 border-l-2 border-blue-200 pl-3 text-sm dark:border-blue-900">
      {fields.map(
        (f) =>
          f.value && (
            <div key={f.label}>
              <p className="font-medium text-muted-foreground text-xs">{f.label}</p>
              <p className="whitespace-pre-wrap">{f.value}</p>
            </div>
          )
      )}
      {hasDetail && !hasClinical && (
        <p className="text-muted-foreground whitespace-pre-wrap">{item.detail}</p>
      )}
      {hasWeight && (
        <p>
          <span className="font-medium text-muted-foreground">Peso: </span>
          {item.weight} kg
        </p>
      )}
      {hasNextControl && (
        <p>
          <span className="font-medium text-muted-foreground">Próximo control: </span>
          {formatRecordDate(item.nextControlAt, true)}
        </p>
      )}
    </div>
  );
}

// ── Inline edit form ─────────────────────────────────────────

const TEXTAREA = "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:cursor-not-allowed disabled:opacity-50";

function EditForm({
  item,
  petId,
  onSaved,
  onCancel,
}: {
  item: TimelineItem;
  petId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const tenant = useTenant();
  const id = useId();
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.date ? item.date.slice(0, 10) : "");
  const [detail, setDetail] = useState(item.detail ?? "");
  const [reason, setReason] = useState(item.reason ?? "");
  const [findings, setFindings] = useState(item.findings ?? "");
  const [diagnosis, setDiagnosis] = useState(item.diagnosis ?? "");
  const [treatment, setTreatment] = useState(item.treatment ?? "");
  const [recommendations, setRecommendations] = useState(item.recommendations ?? "");
  const [nextControlAt, setNextControlAt] = useState(item.nextControlAt ? item.nextControlAt.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConsultation = item.kind === "consultation";
  const hasNextControl = item.kind === "vaccine" || item.kind === "deworming" || item.kind === "grooming";

  const dirty = title !== item.title || date !== (item.date?.slice(0, 10) ?? "") || detail !== (item.detail ?? "") ||
    reason !== (item.reason ?? "") || findings !== (item.findings ?? "") || diagnosis !== (item.diagnosis ?? "") ||
    treatment !== (item.treatment ?? "") || recommendations !== (item.recommendations ?? "") || nextControlAt !== (item.nextControlAt?.slice(0, 10) ?? "");
  const discard = useDialogEditGuard(dirty, saving);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("El título es obligatorio"); return; }
    if (hasNextControl && nextControlAt && date && nextControlAt < date) { setError("La próxima fecha debe ser igual o posterior a la aplicación."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/pets/${petId}/records/${item.recordId}${tenantQuery(tenant)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          date: date || null,
          detail: detail || null,
          reason: reason || null,
          findings: findings || null,
          diagnosis: diagnosis || null,
          treatment: treatment || null,
          recommendations: recommendations || null,
          nextControlAt: nextControlAt || null,
        }),
      });
      if (!res.ok) { const payload = await res.json().catch(() => null); throw new Error(payload?.error || "No se pudo guardar el registro."); }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-2 space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="space-y-1">
        <label htmlFor={`${id}-title`} className="text-sm font-medium">Título *</label>
        <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-date`} className="text-sm font-medium">Fecha</label>
          <Input type="date" id={`${id}-date`} value={date} onInput={(e) => setDate(e.currentTarget.value)} onChange={(e) => setDate(e.target.value)} disabled={saving} />
        </div>
        {hasNextControl && (
          <div className="space-y-1">
            <label htmlFor={`${id}-nextControlAt`} className="text-sm font-medium">
              {item.kind === "vaccine" ? "Próxima vacunación" : item.kind === "grooming" ? "Próxima visita" : "Próxima desparasitación"}
            </label>
            <Input type="date" id={`${id}-nextControlAt`} value={nextControlAt} onInput={(e) => setNextControlAt(e.currentTarget.value)} onChange={(e) => setNextControlAt(e.target.value)} disabled={saving} />
          </div>
        )}
      </div>
      {isConsultation ? (
        <>
          <div className="space-y-1">
            <label htmlFor={`${id}-reason`} className="text-sm font-medium">Anamnesis / Motivo</label>
            <textarea rows={3} id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} disabled={saving} className={TEXTAREA} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-findings`} className="text-sm font-medium">Hallazgos clínicos</label>
            <textarea rows={2} id={`${id}-findings`} value={findings} onChange={(e) => setFindings(e.target.value)} disabled={saving} className={TEXTAREA} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-diagnosis`} className="text-sm font-medium">Diagnóstico</label>
            <textarea rows={2} id={`${id}-diagnosis`} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} disabled={saving} className={TEXTAREA} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-treatment`} className="text-sm font-medium">Tratamiento</label>
            <textarea rows={2} id={`${id}-treatment`} value={treatment} onChange={(e) => setTreatment(e.target.value)} disabled={saving} className={TEXTAREA} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-recommendations`} className="text-sm font-medium">Recomendaciones</label>
            <textarea rows={2} id={`${id}-recommendations`} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} disabled={saving} className={TEXTAREA} />
          </div>
        </>
      ) : (
        <div className="space-y-1">
          <label htmlFor={`${id}-detail`} className="text-sm font-medium">Detalle</label>
          <Textarea rows={5} aria-label="Detalle del registro" id={`${id}-detail`} value={detail} onChange={(e) => setDetail(e.target.value)} disabled={saving} />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => discard(onCancel)} disabled={saving}>Cancelar</Button>
      </div>
    </form>
  );
}

// ── Single timeline item ─────────────────────────────────────

function TimelineEntry({
  item,
  petId,
  onReload,
  onDelete,
  onEditingChange,
}: {
  item: TimelineItem;
  petId: string;
  onReload?: () => void;
  onDelete: (id: string) => void;
  onEditingChange: (id: string, editing: boolean) => void;
}) {
  const tenant = useTenant();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const meta = kindMeta(item.kind);
  const hasClinical =
    item.reason || item.findings || item.diagnosis || item.treatment ||
    item.recommendations || item.weight != null || item.nextControlAt || item.detail;
  const isCancelled = item.kind === "cancelled" || item.kind === "no_show";
  const isRecord = !!item.recordId && !item.appointmentId;
  useEffect(() => { onEditingChange(item.id, editing); return () => onEditingChange(item.id, false); }, [editing, item.id, onEditingChange]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/pets/${petId}/records/${item.recordId}`), {
        method: "DELETE",
      });
      if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error(payload?.error || "No se pudo eliminar el registro."); }
      onDelete(item.id);
      onReload?.();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "No se pudo eliminar el registro.");
    } finally { setDeleting(false); }
  }

  return (
    <div className={`flex gap-3 py-2.5 ${isCancelled ? "opacity-50" : ""}`}>
      {/* Icon column */}
      <div className="w-6 shrink-0 text-center pt-0.5">
        <span className="text-base leading-none">{meta.icon}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${isCancelled ? "line-through" : ""}`}>
              {item.title}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {formatRecordDate(item.date, Boolean(item.recordId && !item.appointmentId && /T00:00:00(?:\.000)?Z$/.test(item.date)))}
              </span>
              {item.staffName && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{item.staffName}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {item.appointmentStatus && (
              <Badge variant="outline" className={`text-xs ${statusBadgeClass(item.appointmentStatus)}`}>
                {formatStatus(item.appointmentStatus)}
              </Badge>
            )}
            {hasClinical && !editing && (
              <button
                aria-label={expanded ? "Cerrar detalle" : "Ver detalle"} aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            )}
            {isRecord && !editing && !confirmDelete && (
              <>
                <button
                  aria-label="Editar registro"
                  onClick={() => { setEditing(true); setExpanded(false); }}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  aria-label="Eliminar registro"
                  onClick={() => setConfirmDelete(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {item.recordId && item.appointmentId && item.kind === "consultation" && <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline" href={consultationHref({ id: item.appointmentId, date: item.date }, tenant)}>Abrir esta consulta para revisar o corregir</Link>}
        {expanded && !editing && <ClinicalDetail item={item} />}
        {deleteError && <p role="alert" className="mt-2 text-sm text-destructive">{deleteError}</p>}

        {editing && (
          <EditForm
            item={item}
            petId={petId}
            onSaved={() => { setEditing(false); onReload?.(); }}
            onCancel={() => setEditing(false)}
          />
        )}

        {confirmDelete && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <span className="flex-1 text-destructive">¿Eliminar este registro?</span>
            <Button
              size="sm"
              variant="destructive"
              className="min-h-11 px-3 text-sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "…" : "Eliminar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11 px-3 text-sm"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Next actions section ─────────────────────────────────────

function NextActionsSection({ actions: initial, onReload }: { actions: NextAction[]; onReload?: () => void }) {
  const tenant = useTenant();
  const [actionError, setActionError] = useState<string | null>(null);
  const actions = initial;
  const [busy, setBusy] = useState<string | null>(null);

  if (actions.length === 0) return null;

  async function updateAction(id: string, status: "done" | "dismissed") {
    setBusy(id);
    setActionError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/next-actions/${id}${tenantQuery(tenant)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onReload?.();
      } else throw new Error("No se pudo actualizar el seguimiento.");
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "No se pudo actualizar."); } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/20">
      <p className="mb-2 text-xs font-semibold uppercase text-amber-700 dark:text-amber-700">
        📌 Próximas acciones
      </p>
      {actionError && <p role="alert" className="mb-2 text-sm text-destructive">{actionError}</p>}
      <ul className="space-y-2">
        {actions.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-2 text-sm">
            <div className="flex flex-col min-w-0">
              <span className="text-foreground font-medium">{a.title}</span>
              <span className="text-xs text-amber-600 dark:text-amber-700">
                {formatRecordDate(a.date, !a.id.startsWith("appointment-") && /T00:00:00(?:\.000)?Z$/.test(a.date))}
              </span>
              {a.detail && (
                <span className="text-xs text-muted-foreground">{a.detail}</span>
              )}
            </div>
            {a.actionId && (
              <div className="flex gap-1.5 shrink-0">
                <button
                  disabled={busy === a.actionId}
                  onClick={() => updateAction(a.actionId!, "done")}
                  className="rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950 dark:text-green-300 disabled:opacity-50"
                >
                  ✓ Hecho
                </button>
                <button
                  disabled={busy === a.actionId}
                  onClick={() => updateAction(a.actionId!, "dismissed")}
                  className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-50"
                >
                  Descartar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main timeline component ──────────────────────────────────

type Props = {
  items: TimelineItem[];
  nextActions: NextAction[];
  petId: string;
  onReload?: () => void;
};

export function PetTimeline({ items, nextActions, petId, onReload }: Props) {
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [editors, setEditors] = useState<Set<string>>(new Set());
  const onEditingChange = useCallback((id: string, editing: boolean) => {
    setEditors((current) => { if (current.has(id) === editing) return current; const next = new Set(current); if (editing) next.add(id); else next.delete(id); return next; });
  }, []);
  function handleDelete(id: string) { setDeleted((current) => new Set(current).add(id)); }
  const allItems = items.filter((item) => !deleted.has(item.id));
  const visibleItems = allItems.filter((item) => matchesHistory(item, filter, query));
  const groups = new Map<string, TimelineItem[]>();
  for (const item of visibleItems) {
    const calendarRecord = item.recordId && !item.appointmentId && /T00:00:00(?:\.000)?Z$/.test(item.date);
    const label = groupLabel(calendarRecord ? `${item.date.slice(0, 10)}T12:00:00Z` : item.date);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  const editing = editors.size > 0;
  return <div className="space-y-4">
    <NextActionsSection actions={nextActions} onReload={onReload} />
    <section aria-label="Buscar en el historial" className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <label className="block text-sm font-semibold">Buscar en el historial
        <Input className="mt-2 bg-card" type="search" placeholder="Servicio, producto, diagnóstico o profesional" value={query} onChange={(e) => setQuery(e.target.value)} disabled={editing} />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipos de registro">
        {HISTORY_FILTERS.map((option) => <Button key={option.id} size="sm" variant={filter === option.id ? "default" : "outline"} className="min-h-11" aria-pressed={filter === option.id} disabled={editing} onClick={() => setFilter(option.id)}>{option.label}</Button>)}
      </div>
      <p role="status" className="text-xs text-muted-foreground">{visibleItems.length} de {allItems.length} registros y citas{editing ? " · Guarda o cancela la edición para cambiar los filtros." : ""}</p>
    </section>
    {visibleItems.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">{allItems.length ? "No hay coincidencias con estos filtros." : "Todavía no hay registros ni citas en el historial."}</p>
      {allItems.length > 0 && <Button variant="outline" className="mt-3" onClick={() => { setQuery(""); setFilter("all"); }}>Limpiar filtros</Button>}
    </div>}
    {[...groups].map(([label, entries]) => <section key={label} aria-label={label}>
      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{label}</h4>
      <div className="divide-y rounded-xl border bg-card">{entries.map((item) => <div key={item.id} className="px-4"><TimelineEntry item={item} petId={petId} onReload={onReload} onDelete={handleDelete} onEditingChange={onEditingChange} /></div>)}</div>
    </section>)}
  </div>;
}
