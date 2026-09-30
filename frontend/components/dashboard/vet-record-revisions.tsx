"use client";

import { useEffect, useState } from "react";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { formatColombiaDateTime } from "@/lib/appointments";

type Snapshot = Record<string, string | number | null>;
type Revision = { id: string; version: number; before: Snapshot; after: Snapshot; reason: string; actorType: string; actorName: string; createdAt: string };
export const CLINICAL_LABELS: Record<string, string> = {
  title: "Título", detail: "Detalle", date: "Fecha de consulta", staffId: "Profesional (identificador)",
  reason: "Motivo de consulta", findings: "Hallazgos y examen físico", diagnosis: "Diagnóstico",
  treatment: "Tratamiento", recommendations: "Recomendaciones", weight: "Peso (kg)", nextControlAt: "Control recomendado",
};

function display(value: string | number | null | undefined, key: string) {
  if (value == null || value === "") return "Sin registrar";
  if ((key === "date" || key === "nextControlAt") && typeof value === "string") return formatColombiaDateTime(value);
  return String(value);
}

export function VetRecordRevisions({ petId, recordId, version = 1, refresh = 0 }: { petId: string; recordId: string; version?: number; refresh?: number }) {
  const tenant = useTenant();
  const [expanded, setExpanded] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    void (async () => {
      setLoading(true); setError(false);
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/pets/${petId}/records/${recordId}/revisions${tenantQuery(tenant)}`), { cache: "no-store" });
        if (!response.ok) throw new Error("revisions");
        const payload = await response.json() as { revisions: Revision[] };
        if (!Array.isArray(payload.revisions)) throw new Error("revisions");
        if (!cancelled) setRevisions(payload.revisions);
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [expanded, petId, recordId, tenant, retry, refresh, version]);
  return <section className="rounded-xl border border-slate-200 bg-white">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50">
      Historial de correcciones <span className="text-xs font-normal text-slate-500">Versión {version} · {expanded ? "Ocultar" : "Ver"}</span>
    </button>
    {expanded && <div className="space-y-3 border-t border-slate-200 p-4">
      <p className="text-xs text-slate-500">Se conservan las correcciones realizadas desde la activación de esta función. No se reconstruyen modificaciones anteriores.</p>
      {loading ? <p role="status" className="text-sm">Cargando correcciones…</p> : error ? <p role="alert" className="text-sm text-amber-900">No se pudieron cargar las correcciones. <button type="button" onClick={() => setRetry((value) => value + 1)} className="font-semibold underline">Reintentar</button></p> : revisions.length === 0 ? <p className="text-sm text-slate-600">No hay correcciones registradas.</p> : revisions.map((revision) => <details key={revision.id} className="rounded-lg border border-slate-200">
        <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-slate-800">Versión {revision.version} → {revision.version + 1} · {formatColombiaDateTime(revision.createdAt)}<span className="mt-1 block text-xs font-normal text-slate-600">{revision.actorName} · {revision.actorType === "vet" ? "Veterinario" : "Administrador"}</span></summary>
        <div className="space-y-3 border-t border-slate-200 px-3 py-3">
          <p className="whitespace-pre-wrap text-sm"><strong>Motivo:</strong> {revision.reason}</p>
          <dl className="space-y-3">{Object.entries(CLINICAL_LABELS).filter(([key]) => revision.before[key] !== revision.after[key]).map(([key, label]) => <div key={key}><dt className="text-sm font-semibold">{label}</dt><dd className="mt-1 grid gap-2 text-xs sm:grid-cols-2"><p className="whitespace-pre-wrap rounded-lg bg-amber-50 p-2"><strong>Antes:</strong> {display(revision.before[key], key)}</p><p className="whitespace-pre-wrap rounded-lg bg-teal-50 p-2"><strong>Después:</strong> {display(revision.after[key], key)}</p></dd></div>)}</dl>
          <details className="text-xs"><summary className="cursor-pointer font-semibold text-teal-800">Ver contenido completo de ambas versiones</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{(["before", "after"] as const).map((side) => <section key={side} className="space-y-2 rounded-lg bg-slate-50 p-3"><h4 className="font-bold">{side === "before" ? "Versión anterior" : "Versión corregida"}</h4>{Object.entries(CLINICAL_LABELS).map(([key, label]) => <p key={key} className="whitespace-pre-wrap"><strong>{label}:</strong> {display(revision[side][key], key)}</p>)}</section>)}</div></details>
        </div>
      </details>)}
    </div>}
  </section>;
}
