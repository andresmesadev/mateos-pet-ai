"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CustomerFollowupActions } from "@/components/dashboard/customer-followup-actions";
import { proxyUrl } from "@/lib/api";
import { useTenant, tenantQuery } from "@/lib/use-tenant";
import { contactPhoneValid, followupDate, type InactiveClient, type InactiveClientsPage } from "@/lib/customer-followup";
type Channel = { ready: boolean; preview: string; reason: string | null };
type CampaignResult = { sent: number; failed: number; noPhone: number; total: number; recipients: { id: string; status: string; reason?: string; name?: string }[] };
export function ReactivationCampaign({ initialData }: { initialData: InactiveClientsPage }) {
  const tenant = useTenant();
  return <ReactivationWorkspace key={tenant ?? "single"} initialData={initialData} />;
}
function ReactivationWorkspace({ initialData }: { initialData: InactiveClientsPage }) {
  const router = useRouter();
  const tenant = useTenant(); const [channel, setChannel] = useState<Channel | null>(null);
  const [selected, setSelected] = useState<Map<string, InactiveClient>>(new Map());
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const [contact, setContact] = useState("all"); const [contactFrom, setContactFrom] = useState(""); const [contactTo, setContactTo] = useState("");
  const [listRevision, setListRevision] = useState(0);
  const [listResult, setListResult] = useState<{ key: string; data: InactiveClientsPage | null; error: string | null } | null>(null);
  const [preview, setPreview] = useState(false); const [sending, setSending] = useState(false);
  const [result, setResult] = useState<CampaignResult | null>(null); const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(proxyUrl(`/api/dashboard/campaigns/reactivation/context${tenantQuery(tenant)}`), { cache: "no-store", signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error(); return res.json();
    }).then(setChannel).catch(() => { if (!controller.signal.aborted) setChannel({ ready: false, preview: "", reason: "No se pudo comprobar el canal de WhatsApp. Reintenta antes de enviar." }); });
    return () => controller.abort();
  }, [tenant, reload]);
  const params = new URLSearchParams({ page: String(page), search, contact });
  if (contact === "recorded") { if (contactFrom) params.set("contactFrom", contactFrom); if (contactTo) params.set("contactTo", contactTo); }
  if (tenant) params.set("tenantId", tenant);
  const query = params.toString(); const listKey = `${query}|${listRevision}`;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/clients/inactive?${query}`), { cache: "no-store", signal: controller.signal });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "No se pudieron consultar los clientes.");
        if (!payload || !Array.isArray(payload.data)) throw new Error("La respuesta de clientes no es válida.");
        if (!controller.signal.aborted) setListResult({ key: listKey, data: payload, error: null });
      } catch (err) { if (!controller.signal.aborted) setListResult({ key: listKey, data: null, error: err instanceof Error ? err.message : "No se pudieron consultar los clientes." }); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, listKey]);
  const initial = page === 1 && !search && contact === "all" && listRevision === 0;
  const current = listResult?.key === listKey ? listResult.data : initial ? initialData : null;
  const listError = listResult?.key === listKey ? listResult.error : null;
  const visible = current?.data ?? [];
  const pages = current?.totalPages ?? 1; const currentPage = current?.page ?? page;
  const eligible = visible.filter(c => contactPhoneValid(c.phone));
  const pageSelected = eligible.length > 0 && eligible.every(c => selected.has(c.id));
  const chosen = [...selected.values()];
  function toggle(client: InactiveClient) { setSelected(prev => { const next = new Map(prev); if (next.has(client.id)) next.delete(client.id); else if (next.size < 500) next.set(client.id, client); return next; }); }
  function togglePage() { setSelected(prev => { const next = new Map(prev); eligible.forEach(c => { if (pageSelected) next.delete(c.id); else if (next.size < 500) next.set(c.id, c); }); return next; }); }
  async function send() {
    if (!channel?.ready || !chosen.length || sending) return;
    setSending(true); setError(null); setResult(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/campaigns/reactivation${tenantQuery(tenant)}`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientIds: chosen.map(c => c.id) }) });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "No se confirmó el envío. La selección se conserva.");
      if (!payload || !Array.isArray(payload.recipients)) throw new Error("No se pudo verificar el resultado. Revisa las conversaciones antes de volver a enviar.");
      setResult({ ...payload, recipients: payload.recipients.map((recipient: CampaignResult["recipients"][number]) => ({ ...recipient, name: selected.get(recipient.id)?.name ?? "Cliente" })) }); setPreview(false);
      const sent = new Set(payload.recipients.filter((r: { status: string }) => r.status === "sent").map((r: { id: string }) => r.id));
      setSelected(prev => new Map([...prev].filter(([id]) => !sent.has(id))));
      setListRevision(value => value + 1);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo verificar el envío."); }
    finally { setSending(false); }
  }
  return <div className="space-y-5">
    <section className="space-y-3 rounded-2xl border bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Contacto por WhatsApp</h3><Button variant="outline" size="sm" disabled={sending} onClick={() => { setChannel(null); setReload(r => r + 1); }}>Comprobar canal</Button></div><p className="text-sm text-muted-foreground">Para volver a contactar se utiliza la plantilla de reactivación configurada. Revisa el texto y los destinatarios antes de confirmar.</p>{!channel ? <p role="status" className="text-sm">Comprobando disponibilidad…</p> : channel.ready ? <p className="text-sm text-teal-800">Canal y nombre de plantilla configurados. WhatsApp validará cada envío.</p> : <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{channel.reason}</p>}{channel?.preview && <details className="text-sm"><summary className="cursor-pointer font-medium">Ver texto de la plantilla</summary><p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/40 p-4">{channel.preview}</p></details>}</section>
    {result && <div role="status" className={`rounded-xl border p-4 ${result.sent === result.total ? "border-teal-200 bg-teal-50 text-teal-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}><h3 className="font-semibold">{result.sent === 0 ? "No se confirmó ningún envío" : result.sent === result.total ? "Envíos confirmados" : "Envío con resultados parciales"}</h3><p className="mt-1 text-sm">{result.sent} enviados · {result.failed} fallidos · {result.noPhone} sin teléfono válido · {result.total} seleccionados</p><p className="mt-2 text-sm">Los contactos enviados se retiraron de la selección. Revisa los fallidos antes de reintentar.</p>{result.recipients.some(r => r.reason) && <ul className="mt-3 space-y-1 text-sm">{result.recipients.filter(r => r.reason).map(r => <li key={r.id}>{r.name}: {r.reason}</li>)}</ul>}</div>}
    {!preview && error && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="space-y-4 border-b p-6"><div><h3 className="font-semibold">Clientes sin visita de peluquería en más de 60 días</h3><p className="mt-1 text-sm text-muted-foreground">Consulta todos los clientes que cumplen el criterio, primero los que llevan más tiempo sin volver. Se muestran 20 por página.</p></div>
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 space-y-1 text-sm font-medium">Buscar cliente o mascota<Input placeholder="Nombre del cliente, mascota o teléfono" value={search} disabled={sending} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><label className="space-y-1 text-sm font-medium">Último contacto<select className="block h-11 max-w-full rounded-xl border bg-white px-3" value={contact} disabled={sending} onChange={e => { setContact(e.target.value); setPage(1); }}><option value="all">Todos</option><option value="never">Sin contacto registrado</option><option value="recorded">Con contacto registrado</option></select></label><Button variant="outline" disabled={sending} onClick={() => setListRevision(value => value + 1)}>Actualizar clientes</Button></div>
      {contact === "recorded" && <div className="space-y-2"><div className="flex flex-wrap gap-3"><label className="space-y-1 text-sm font-medium">Contacto desde<Input type="date" value={contactFrom} disabled={sending} onChange={e => { setContactFrom(e.target.value); setPage(1); }} /></label><label className="space-y-1 text-sm font-medium">Contacto hasta<Input type="date" value={contactTo} disabled={sending} onChange={e => { setContactTo(e.target.value); setPage(1); }} /></label></div><p className="text-xs text-muted-foreground">Fechas de Bogotá, inclusive. Puedes dejar un extremo vacío. Un contacto registrado no confirma que el mensaje fue leído.</p></div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pageSelected} disabled={!eligible.length || sending} onChange={togglePage} />Seleccionar contactos válidos de esta página</label><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!chosen.length || sending} onClick={() => setSelected(new Map())}>Limpiar selección</Button><Button disabled={!channel?.ready || !chosen.length || sending} onClick={() => { setError(null); setPreview(true); }}>Revisar envío ({chosen.length})</Button></div></div><p className="text-xs text-muted-foreground">{chosen.length} seleccionados de un máximo de 500 por envío. La selección se conserva al buscar o cambiar de página. Los clientes sin teléfono válido no se pueden seleccionar.</p></div>
      {listError ? <div role="alert" className="space-y-3 p-6 text-amber-900"><p>{listError}</p><Button variant="outline" onClick={() => setListRevision(value => value + 1)}>Reintentar consulta</Button></div> : !current ? <p role="status" className="p-8 text-muted-foreground">Consultando clientes…</p> : <><ul className="divide-y">{visible.map(c => <li key={c.id} className="space-y-3 p-5 sm:p-6"><label className="flex items-start gap-3"><input aria-label={`Seleccionar a ${c.name ?? "cliente sin nombre"}`} type="checkbox" className="mt-1" checked={selected.has(c.id)} disabled={sending || !contactPhoneValid(c.phone) || (!selected.has(c.id) && selected.size >= 500)} onChange={() => toggle(c)} /><span><span className="font-semibold">{c.name ?? "Sin nombre"}</span><span className="mt-1 block text-sm text-muted-foreground">{contactPhoneValid(c.phone) ? c.phone : "Sin teléfono válido"} · {c.pets.map(p => p.name).join(", ")}</span></span></label><p className="text-sm text-muted-foreground">Última visita: {followupDate(c.lastVisitDate)}</p><p className={`w-fit rounded-lg px-3 py-2 text-sm ${c.lastReminderSentAt ? "bg-amber-50 text-amber-900" : "bg-muted/50 text-muted-foreground"}`}>{c.lastReminderSentAt ? `Último contacto registrado: ${followupDate(c.lastReminderSentAt)}` : "Sin contacto registrado"}</p><CustomerFollowupActions ownerId={c.id} petId={c.pets.length === 1 ? c.pets[0].id : undefined} category="grooming" /></li>)}</ul>
      {!visible.length && <div className="p-10 text-center"><h4 className="font-semibold">No hay clientes en esta vista</h4><p className="mt-2 text-sm text-muted-foreground">{search || contact !== "all" ? "Prueba con otro nombre, teléfono o filtro de contacto." : "No se encontraron clientes sin visita de peluquería en más de 60 días."}</p></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-5"><p className="text-sm text-muted-foreground">{current.total} clientes encontrados · Página {currentPage} de {pages}</p><div className="flex gap-2"><Button variant="outline" disabled={currentPage <= 1 || sending} onClick={() => setPage(currentPage - 1)}>Anterior</Button><Button variant="outline" disabled={currentPage >= pages || sending} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></div></div></>}
    </section>
    <Dialog open={preview} onOpenChange={open => { if (!sending) setPreview(open); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showClose={!sending}><DialogHeader><DialogTitle>Revisar contacto a {chosen.length} clientes</DialogTitle><DialogDescription>Confirma los destinatarios y el mensaje. Solo se enviará al pulsar Confirmar envío.</DialogDescription></DialogHeader><p className="whitespace-pre-wrap rounded-xl bg-teal-50 p-4 text-sm">{channel?.preview.replace("{nombre}", chosen[0]?.name?.trim() || "cliente")}</p><p className="text-xs text-muted-foreground">Vista previa del primer destinatario. El nombre se adapta para cada cliente.</p><ul className="max-h-48 space-y-1 overflow-y-auto text-sm">{chosen.map(c => <li key={c.id}>{c.name ?? "Sin nombre"} · {c.phone}{c.lastReminderSentAt && ` · Contactado: ${followupDate(c.lastReminderSentAt)}`}</li>)}</ul>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={sending} onClick={() => setPreview(false)}>Volver</Button><Button disabled={sending || !channel?.ready} onClick={send}>{sending ? "Enviando…" : "Confirmar envío"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
