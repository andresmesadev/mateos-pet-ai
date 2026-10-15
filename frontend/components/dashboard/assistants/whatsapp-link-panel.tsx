"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { ResultDetails } from "./assistant-forms";
type Link = { id: string; phone: string; state: string; expiresAt: string };
type Challenge = { id: string; phone: string; state: string; expiresAt: string };
type Status = { enabled: boolean; tenantId?: string; links: Link[]; challenge: Challenge | null; issues?: { id: string; phase: string; createdAt: string; taskId?: string | null }[] };
export function WhatsappLinkPanel({ tenant }: { tenant: string | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [phone, setPhone] = useState(""); const [password, setPassword] = useState("");
  const [command, setCommand] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [review, setReview] = useState<unknown>(null);
  const api = useCallback(async (path = "", body?: unknown) => {
    const response = await fetch(proxyUrl(`/api/dashboard/operational-assistants/whatsapp${path}${tenant ? "?tenantId=" + encodeURIComponent(tenant) : ""}`), {
      method: body === undefined ? "GET" : "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(14000) });
    const data = await response.json(); if (!response.ok) throw Error(data.error || "No se pudo comprobar el vínculo. Actualiza su estado antes de repetir."); return data;
  }, [tenant]);
  const load = useCallback(async () => setStatus(await api() as Status), [api]);
  useEffect(() => { let active = true; api().then(data => { if (active) setStatus(data as Status); }).catch(() => { if (active) setError("No se pudo consultar tu acceso por WhatsApp."); }); return () => { active = false; }; }, [api]);
  useEffect(() => {
    if (status?.challenge?.state !== "pending") return;
    const timer = setInterval(() => { void load().catch(() => {}); }, 4000); return () => clearInterval(timer);
  }, [status?.challenge?.state, load]);
  async function perform(fn: () => Promise<void>) {
    setBusy(true); setError(""); try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo comprobar el resultado."); } finally { setPassword(""); setBusy(false); }
  }
  async function verify(purpose: string, binding: Record<string, string>) {
    const response = await fetch("/api/operator-channel/reauth", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, binding, password, tenantId: tenant || status?.tenantId }), signal: AbortSignal.timeout(7000) });
    const data = await response.json(); if (!response.ok) throw Error(data.error || "No se pudo verificar tu identidad."); return data.proof;
  }
  const activeLink = status?.links.find(l => l.state === "active");
  return <section className="rounded-2xl border bg-white p-5 sm:p-6" aria-labelledby="whatsapp-link-title">
    <h2 id="whatsapp-link-title" className="font-semibold">Tus empleados por WhatsApp</h2>
    <p className="mt-2 text-sm text-slate-600">Vincula tu propio teléfono para consultar el negocio y preparar operaciones. Tu acceso conserva los permisos de tu cuenta.</p>
    {error && <p role="alert" className="mt-3 text-sm text-amber-900">{error}</p>}
    {!status ? <p role="status" className="mt-3 text-sm">Consultando tu vínculo…</p> : !status.enabled ? <p className="mt-3 text-sm text-slate-600">El canal privado aún no está habilitado en este entorno.</p> : <>
      {!!status.issues?.length && <div role="alert" className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><p>Un mensaje requiere revisión. Comprueba la última atención y sus recibos antes de continuar; el envío no se repetirá automáticamente.</p>{status.issues.map(issue => <div className="space-y-3" key={issue.id}><p>Mensaje del {new Date(issue.createdAt).toLocaleString("es-CO")}</p>{issue.taskId && <Button variant="outline" disabled={busy} onClick={() => void perform(async () => {
        const response = await fetch(proxyUrl(`/api/dashboard/operational-assistants/tasks/${encodeURIComponent(issue.taskId!)}${tenant ? "?tenantId=" + encodeURIComponent(tenant) : ""}`), { cache: "no-store", signal: AbortSignal.timeout(14000) });
        const result = await response.json(); if (!response.ok) throw Error(result.error || "No se pudo comprobar la atención."); setReview(result.action?.receipt || result.action?.preview || result.result);
      })}>Consultar atención y recibo</Button>}<Button variant="outline" disabled={busy} onClick={() => void perform(async () => { await api("/acknowledge", { jobId: issue.id }); setReview(null); })}>Ya verifiqué el resultado: continuar</Button></div>)}{review != null && <div className="rounded-lg bg-white p-3"><ResultDetails value={review} /></div>}</div>}
      {activeLink && <div className="mt-4 rounded-xl bg-teal-50 p-4 text-sm"><p>Teléfono vinculado: <strong>{activeLink.phone}</strong></p><p>Autorización hasta {new Date(activeLink.expiresAt).toLocaleString("es-CO")}. La sesión se cierra tras 15 minutos de inactividad.</p><div className="mt-3 flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={busy || !password} onClick={() => void perform(async () => { const proof = await verify("link_renew", { linkId: activeLink.id }); await api("/renew", { linkId: activeLink.id, proof }); setCommand(""); })}>Renovar acceso por 8 horas</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void perform(async () => { await api("/revoke", { linkId: activeLink.id }); setCommand(""); })}>Revocar vínculo</Button></div></div>}
      <fieldset disabled={busy} className="mt-4 space-y-4 disabled:opacity-60">
        <label className="block text-sm font-medium">Tu número con código de país<input type="tel" inputMode="numeric" autoComplete="tel" maxLength={15} placeholder="573001234567" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label>
        <label className="block text-sm font-medium">Confirma tu contraseña del dashboard<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border px-3" /><span className="text-xs font-normal text-slate-500">Se verifica en el dashboard; nunca la envíes por WhatsApp.</span></label>
        <Button type="button" disabled={!password || !/^[1-9][0-9]{6,14}$/.test(phone)} onClick={() => void perform(async () => { const proof = await verify("link_start", { phone }); const started = await api("/start", { phone, proof }); setCommand(started.command); })}>{activeLink ? "Vincular otro teléfono" : "Generar código de vinculación"}</Button>
      </fieldset>
      {command && <div className="mt-4 rounded-xl border border-teal-200 p-4 text-sm"><p>Desde el teléfono indicado, envía este comando al WhatsApp del establecimiento antes de cinco minutos:</p><code className="my-3 block break-all rounded-lg bg-slate-100 p-3">{command}</code><p>Después vuelve aquí para activar el vínculo.</p></div>}
      {status.challenge && <div className="mt-4 space-y-3 text-sm"><p>{status.challenge.state === "proved" ? "Teléfono verificado. Vuelve a escribir tu contraseña y activa el vínculo." : "Esperando el comando desde tu teléfono."} El código vence {new Date(status.challenge.expiresAt).toLocaleTimeString("es-CO")}.</p>
        <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={busy} onClick={() => void perform(load)}>Actualizar estado</Button>
          <Button type="button" disabled={busy || !password || status.challenge.state !== "proved"} onClick={() => void perform(async () => { const challengeId = status.challenge!.id; const proof = await verify("link_activate", { challengeId }); await api("/activate", { challengeId, proof }); setCommand(""); })}>Activar vínculo verificado</Button></div></div>}
      {activeLink && <p className="mt-4 text-sm text-slate-600">En WhatsApp escribe <strong>/negocio</strong> y elige «finanzas» o «inventario». Usa <strong>/clientes</strong> para volver a la atención al cliente. Cada operación exige revisar la propuesta y pulsar su botón de confirmación.</p>}
    </>}
  </section>;
}
