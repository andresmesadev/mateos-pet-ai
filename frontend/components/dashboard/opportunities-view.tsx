"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CustomerFollowupActions } from "@/components/dashboard/customer-followup-actions";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { proxyUrl } from "@/lib/api";
import { getPetEmoji, NEXT_ACTION_TYPES } from "@/lib/pets";
import { useTenant } from "@/lib/use-tenant";
import { followupDate, followupTiming, type OpportunitiesData, type FollowupEntry } from "@/lib/customer-followup";

function FollowupRow({ entry, onUpdated }: { entry: FollowupEntry; onUpdated: () => void }) {
  const tenant = useTenant();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"done" | "dismissed" | null>(null);
  async function update() {
    if (!confirm) return;
    setBusy(true); setError(null);
    try {
      const path = entry.source === "action" ? `next-actions/${encodeURIComponent(entry.actionId)}` : `medical-records/${encodeURIComponent(entry.actionId)}/dismiss`;
      const res = await fetch(proxyUrl(`/api/dashboard/${path}${tenant ? `?tenantId=${encodeURIComponent(tenant)}` : ""}`), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        ...(entry.source === "action" ? { body: JSON.stringify({ status: confirm }) } : {}),
      });
      if (!res.ok) { const payload = await res.json().catch(() => null); throw new Error(payload?.error ?? "No se pudo guardar el cambio. El pendiente se conserva."); }
      setConfirm(null); onUpdated();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar el cambio."); }
    finally { setBusy(false); }
  }
  const label = entry.type === "grooming" ? "Peluquería" : NEXT_ACTION_TYPES.find(t => t.value === entry.type)?.label ?? entry.type;
  return <li className="space-y-4 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 gap-3"><span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl">{getPetEmoji(entry.petType)}</span><div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{entry.petName}</h3><Badge variant="outline">{label}</Badge>{followupTiming(entry.dayOffset) && <Badge className={entry.dayOffset! <= 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-teal-200 bg-teal-50 text-teal-900"}>{followupTiming(entry.dayOffset)}</Badge>}</div>
        <p className="text-sm text-muted-foreground">{entry.ownerName ?? "Propietario sin nombre"} · {followupDate(entry.dueAt)}</p>
        {entry.notes && <p className="break-words whitespace-pre-wrap text-sm">{entry.notes}</p>}
        {entry.reminderSentAt && <p className="text-xs text-muted-foreground">Último recordatorio: {followupDate(entry.reminderSentAt)}</p>}
        {entry.source === "record" && <p className="text-xs text-muted-foreground">Pendiente de un registro anterior. Ocultarlo no lo marca como realizado.</p>}
      </div></div>
      <div className="flex flex-wrap gap-2">{entry.source === "action" && <Button size="sm" disabled={busy} onClick={() => setConfirm("done")}>Marcar realizado</Button>}<Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirm("dismissed")}>{entry.source === "action" ? "Descartar" : "Ocultar pendiente"}</Button></div>
    </div>
    <CustomerFollowupActions ownerId={entry.ownerId} petId={entry.petId} conversationId={entry.conversationId} category={entry.type === "grooming" ? "grooming" : ["control", "vaccine", "exam", "treatment"].includes(entry.type) ? "veterinary" : undefined} />
    {confirm && <div className="rounded-xl border bg-muted/30 p-4"><p className="mb-3 text-sm">{confirm === "done" ? "Confirma que esta acción ya se realizó. Agendar una cita no completa este pendiente." : "¿Retirar este pendiente de la lista? El historial de la mascota se conserva."}</p><div className="flex gap-2"><Button size="sm" onClick={update} disabled={busy}>{busy ? "Guardando…" : "Confirmar"}</Button><Button size="sm" variant="outline" onClick={() => setConfirm(null)} disabled={busy}>Volver</Button></div></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </li>;
}

export function OpportunitiesView({ data }: { data: OpportunitiesData | null }) {
  const tenant = useTenant(); const router = useRouter(); const access = useDashboardAccess();
  const [search, setSearch] = useState(""); const [type, setType] = useState(""); const [period, setPeriod] = useState("all"); const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data: OpportunitiesData | null; error: string | null } | null>(null);
  const params = new URLSearchParams({ page: String(page), search, type, period });
  if (tenant) params.set("tenantId", tenant);
  const query = params.toString(); const key = `${query}|${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(proxyUrl(`/api/dashboard/opportunities?${query}`), { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error("No se pudieron cargar los pendientes.");
        setResult({ key, data: await res.json(), error: null });
      } catch (err) { if (!controller.signal.aborted) setResult({ key, data: null, error: err instanceof Error ? err.message : "No se pudieron cargar los pendientes." }); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, key]);
  const initial = revision === 0 && page === 1 && !search && !type && period === "all";
  const current = result?.key === key ? result.data : initial ? data : null;
  const error = result?.key === key ? result.error : null;
  const entries = current ? Object.values(current.byType).flat().sort((a, b) => a.dueAt.localeCompare(b.dueAt)) : [];
  const types = NEXT_ACTION_TYPES.filter(t => t.value === "other" || (t.value === "grooming" ? access?.activeModules.includes("grooming") : access?.activeModules.includes("veterinary"))).map(t => t.value === "grooming" ? { ...t, label: "Peluquería" } : t);
  function updated() { setRevision(r => r + 1); router.refresh(); }
  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
    <div className="space-y-4 border-b p-5 sm:p-6"><div><h2 className="text-xl font-semibold">Pendientes del expediente</h2><p className="mt-1 text-sm text-muted-foreground">Controles, cuidados y próximas visitas registrados para cada mascota. Fechas de Bogotá.</p></div>
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 space-y-1 text-sm font-medium">Buscar mascota o propietario<Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Nombre de la mascota o del propietario" /></label><label className="space-y-1 text-sm font-medium">Tipo de pendiente<select className="block h-11 max-w-full rounded-xl border bg-white px-3" value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option value="">Todos los tipos</option>{types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label><Button variant="outline" onClick={updated}>Actualizar</Button></div>
      <div className="flex flex-wrap gap-2" aria-label="Filtrar pendientes por fecha">{([["all", "Todos"], ["past", "Fechas pasadas"], ["today", "Hoy"], ["next7", "Próximos 7 días"]] as const).map(([value, label]) => <Button key={value} variant={period === value ? "default" : "outline"} aria-pressed={period === value} onClick={() => { setPeriod(value); setPage(1); }}>{label}{current?.periodCounts ? ` · ${current.periodCounts[value]}` : ""}</Button>)}</div>
      <p className="text-xs text-muted-foreground">Hoy corresponde al día de Bogotá. Próximos 7 días abarca desde mañana; las cantidades respetan la búsqueda y el tipo elegido.</p>
    </div>
    {error ? <div role="alert" className="space-y-3 p-6 text-amber-900"><p>{error}</p><Button variant="outline" onClick={updated}>Reintentar</Button></div> : !current ? <p role="status" className="p-8 text-muted-foreground">Consultando pendientes…</p> : entries.length ? <><ul className="divide-y">{entries.map(e => <FollowupRow key={`${e.source}:${e.actionId}`} entry={e} onUpdated={updated} />)}</ul><div className="flex flex-wrap items-center justify-between gap-3 border-t p-5"><p className="text-sm text-muted-foreground">{current.total} pendientes · Página {current.page} de {Math.max(1, current.totalPages)}</p><div className="flex gap-2"><Button variant="outline" disabled={current.page <= 1} onClick={() => setPage(current.page - 1)}>Anterior</Button><Button variant="outline" disabled={current.page >= current.totalPages} onClick={() => setPage(current.page + 1)}>Siguiente</Button></div></div></> : <div className="p-10 text-center"><h3 className="font-semibold">No hay pendientes en esta vista</h3><p className="mt-2 text-sm text-muted-foreground">{search || type || period !== "all" ? "Prueba con otros filtros." : access?.activeModules.some(m => ["grooming", "veterinary"].includes(m)) ? "Las próximas acciones que registres en el expediente aparecerán aquí." : "Activa un módulo de atención para gestionar los seguimientos de visitas."}</p></div>}
  </section>;
}
