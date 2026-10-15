"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Bot, CheckCircle2, RefreshCw } from "lucide-react";
import { proxyUrl } from "@/lib/api";
import { useTenant } from "@/lib/use-tenant";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { Button } from "@/components/ui/button";
import { ResultDetails, TASKS, TaskFields } from "./assistant-forms";
import { WhatsappLinkPanel } from "./whatsapp-link-panel";

type Employee = { id: string; specialization: string; status: string; intents: string[] };
type Action = { id: string; taskId: string; kind: string; state: string; revision: number; payload: Record<string, unknown>; preview: unknown; missingFields: string[]; expiresAt: string | null; receipt: { id: string; confirmedAt: string; result: unknown } | null; publication?: { pending: number; review: number; verified: number } };
type Attention = { taskId: string; requestId: string; state: string; result: { kind?: string; intent?: string; parameters?: Record<string, unknown>; data?: unknown; message?: string; observedAt?: string }; action: Action | null };
type Pending = { employeeId: string; body: unknown; taskId?: string };
const NAMES: Record<string, string> = { asistente_financiero: "Asistente Financiero", asistente_administrativo: "Administración e Inventario" };
const STATES: Record<string, string> = { borrador: "Completar datos", lista: "Lista para revisar", confirmada: "Operación confirmada", descartada: "Propuesta descartada", vencida: "Propuesta vencida", rechazada: "Solicitud rechazada" };
export function AssistantsWorkspace() {
  const tenant = useTenant(); const { data: session } = useSession();
  const scope = `${tenant || session?.user?.tenantId || ""}:${session?.user?.staffId || session?.user?.email || ""}`;
  return <Workspace key={scope} tenant={tenant} storageKey={`mateos:operational:${scope}`} />;
}
function Workspace({ tenant, storageKey }: { tenant: string | null; storageKey: string }) {
  const access = useDashboardAccess(); const controller = useRef<AbortController | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState(""); const [intent, setIntent] = useState(""); const [fields, setFields] = useState<Record<string, string>>({});
  const [natural, setNatural] = useState(false); const [description, setDescription] = useState(""); const [attention, setAttention] = useState<Attention | null>(null);
  const [pending, setPending] = useState<Pending | null>(null); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [uncertain, setUncertain] = useState(false); const [error, setError] = useState("");
  const selected = employees.find(e => e.id === employeeId);
  const api = useCallback(async (path: string, method = "GET", body?: unknown): Promise<unknown> => {
    if (!controller.current) controller.current = new AbortController();
    const sep = path.includes("?") ? "&" : "?";
    const response = await fetch(proxyUrl(`/api/dashboard${path}${tenant ? sep + "tenantId=" + encodeURIComponent(tenant) : ""}`), {
      method, cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(14000)]),
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || "No se pudo completar la solicitud."), { uncertain: method !== "GET" && response.status >= 500 });
    return data;
  }, [tenant]);
  const remember = (item: Pending) => { setPending(item); try { sessionStorage.setItem(storageKey, JSON.stringify(item)); } catch { /* Server remains authoritative. */ } };
  const loadEmployees = useCallback(async (next?: string) => {
    const page = await api("/operational-assistants" + (next ? "?cursor=" + encodeURIComponent(next) : "")) as { data: Employee[]; nextCursor: string | null };
    setEmployees(previous => next ? [...previous, ...page.data] : page.data); setCursor(page.nextCursor);
  }, [api]);
  useEffect(() => {
    controller.current = new AbortController();
    const boot = async () => {
      try { await loadEmployees(); const saved = sessionStorage.getItem(storageKey); if (saved) { const item = JSON.parse(saved) as Pending; setPending(item); if (item.taskId) setAttention(await api("/operational-assistants/tasks/" + encodeURIComponent(item.taskId)) as Attention); else setUncertain(true); } }
      catch (e) { if (!controller.current?.signal.aborted) setError(e instanceof Error ? e.message : "No se pudo cargar el espacio."); }
      finally { setLoading(false); }
    };
    void boot(); return () => controller.current?.abort();
  }, [api, loadEmployees, storageKey]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); setUncertain(false); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo comprobar el resultado."); if ((e as { uncertain?: boolean })?.uncertain || (e instanceof Error && ["TimeoutError", "AbortError", "TypeError"].includes(e.name))) setUncertain(true); }
    finally { setBusy(false); }
  }
  async function prepare(item?: Pending) {
    const frozen = item || { employeeId, body: natural ? { requestId: crypto.randomUUID(), text: description } : { requestId: crypto.randomUUID(), intent, fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== "")) } };
    remember(frozen);
    await perform(async () => { const result = await api(`/operational-assistants/${encodeURIComponent(frozen.employeeId)}/requests`, "POST", frozen.body) as Attention; setAttention(result); remember({ ...frozen, taskId: result.taskId }); });
  }
  async function recover() {
    if (!pending) return;
    if (!pending.taskId) return prepare(pending);
    await perform(async () => { const result = await api("/operational-assistants/tasks/" + encodeURIComponent(pending.taskId!)) as Attention; setAttention(result); if (["pendiente", "procesando"].includes(result.state)) setError("La atención sigue en proceso. Recupera de nuevo; si el proceso se interrumpió, usa Reintentar atención."); });
  }
  const action = attention?.action;
  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">Tu equipo digital</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Asistentes del negocio</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Consulta Finanzas e Inventario y prepara operaciones. Tú revisas y confirmas cada gasto o entrada.</p></div><Bot className="h-9 w-9 text-teal-700" aria-hidden /></header>
    {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{error}</div>}
    <WhatsappLinkPanel tenant={tenant} />
    {loading ? <div role="status" className="rounded-2xl border bg-white p-6">Cargando empleados…</div> : <>
      {!employees.length && <section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Aún no hay empleados registrados para estas tareas</h2><p className="mt-2 text-sm text-slate-600">Un administrador puede registrar los empleados para este establecimiento.</p></section>}
      {access?.capabilities.administration && !cursor && Object.keys(NAMES).some(s => !employees.some(e => e.specialization === s)) && <section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Completa tu equipo digital</h2><div className="mt-4 flex flex-wrap gap-3">{Object.entries(NAMES).filter(([s]) => !employees.some(e => e.specialization === s)).map(([specialization, label]) => <Button key={specialization} variant="outline" disabled={busy} onClick={() => void perform(async () => { await api("/digital-employees", "POST", { specialization }); await loadEmployees(); })}>Registrar {label}</Button>)}</div></section>}
      {!!employees.length && <section className="rounded-2xl border bg-white p-5 sm:p-6"><h2 className="mb-4 font-semibold">1. Elige el empleado y la tarea</h2><fieldset disabled={busy || uncertain} className="space-y-4 disabled:opacity-60">
        <label className="block text-sm font-medium">Empleado<select className="mt-1 min-h-11 w-full rounded-lg border px-3" value={employeeId} onChange={e => { setEmployeeId(e.target.value); setIntent(""); setFields({}); }}><option value="">Selecciona un empleado</option>{employees.map(e => <option key={e.id} value={e.id}>{NAMES[e.specialization]} · {e.status === "activo" ? "Activo" : "Pausado"} · {e.id.slice(-6)}</option>)}</select></label>
        {cursor && <Button type="button" variant="outline" onClick={() => void perform(() => loadEmployees(cursor))}>Ver más empleados</Button>}
        {selected && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={natural} onChange={e => setNatural(e.target.checked)} />Describir la tarea con mis palabras</label>
          {natural ? <label className="block text-sm font-medium">¿Qué necesitas?<textarea className="mt-1 min-h-28 w-full rounded-lg border p-3" value={description} maxLength={4000} onChange={e => setDescription(e.target.value)} placeholder="Ejemplo: preparar un gasto de 25.000 pesos por insumos" /><span className="text-xs text-slate-500">Si faltan datos, puedes completar el formulario.</span></label> : <><label className="block text-sm font-medium">Tarea<select className="mt-1 min-h-11 w-full rounded-lg border px-3" value={intent} onChange={e => { setIntent(e.target.value); setFields({}); }}><option value="">Selecciona una tarea</option>{selected.intents.map(i => <option value={i} key={i}>{TASKS[i]?.label || i}</option>)}</select></label>{intent && <TaskFields intent={intent} fields={fields} setFields={setFields} api={api} />}</>}
          <Button disabled={selected.status !== "activo" || (natural ? !description.trim() : !intent)} onClick={() => void prepare()}>{busy ? "Atendiendo…" : "Preparar solicitud"}</Button></>}
      </fieldset></section>}
    </>}
    {pending && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={() => void recover()}><RefreshCw className="h-4 w-4" />Recuperar atención</Button>{attention && ["pendiente", "procesando"].includes(attention.state) && <Button variant="outline" disabled={busy} onClick={() => void prepare(pending)}>Reintentar atención</Button>}{uncertain && <p role="status" className="text-sm text-amber-800">Comprueba la atención guardada antes de iniciar otra operación.</p>}</div>}
    {attention?.result.kind === "query" && <section className="rounded-2xl border bg-white p-6"><h2 className="mb-3 font-semibold">Resultado de la consulta</h2><p className="mb-4 text-xs text-slate-500">Consultado: {attention.result.observedAt ? new Date(attention.result.observedAt).toLocaleString("es-CO") : "—"}. Los datos conservan el instante de consulta.</p><ResultDetails value={attention.result.data} />{Boolean((attention.result.data as { nextCursor?: string })?.nextCursor) && pending && <Button className="mt-4" variant="outline" disabled={busy || uncertain} onClick={() => void prepare({ employeeId: pending.employeeId, body: { requestId: crypto.randomUUID(), intent: attention.result.intent, fields: { ...attention.result.parameters, cursor: (attention.result.data as { nextCursor: string }).nextCursor } } })}>Ver siguientes resultados</Button>}</section>}
    {attention?.result.kind === "clarification" && <p role="status" className="rounded-xl border bg-white p-4 text-sm">{attention.result.message}</p>}
    {action && <Review key={`${action.id}:${action.revision}`} action={action} api={api} busy={busy} uncertain={uncertain} perform={perform} update={value => setAttention(previous => previous ? { ...previous, action: value } : previous)} />}
  </div>;
}
function Review({ action, api, busy, uncertain, perform, update }: { action: Action; api: (path: string, method?: string, body?: unknown) => Promise<unknown>; busy: boolean; uncertain: boolean; perform: (fn: () => Promise<void>) => Promise<void>; update: (value: Action) => void }) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(action.payload).map(([k, v]) => [k, k === "date" && v ? new Date(String(v)).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) : v === null ? "" : String(v)])));
  const open = ["lista", "borrador"].includes(action.state);
  const call = async (verb: string) => update(await api(`/operational-assistants/actions/${action.id}/${verb}`, "POST", { expectedRevision: action.revision }) as Action);
  return <section className="rounded-2xl border bg-white p-5 sm:p-6"><div className="mb-4 flex items-center gap-2">{action.receipt && <CheckCircle2 className="h-5 w-5 text-teal-700" />}<h2 className="font-semibold">{STATES[action.state] || "Atención"}</h2></div>
    {action.receipt ? <><p className="mb-4 text-sm text-teal-800">Guardado el {new Date(action.receipt.confirmedAt).toLocaleString("es-CO")}. Recuperar esta atención devuelve el mismo resultado.</p><ResultDetails value={action.receipt.result} />{action.publication && <p className="mt-4 text-sm text-slate-600">{action.publication.review ? "La operación está guardada; hay notificaciones que requieren revisión administrativa." : action.publication.pending ? "La operación está guardada; sus notificaciones siguen pendientes." : "La operación y sus notificaciones fueron verificadas."}</p>}</> : <>
      {action.state === "vencida" && <Button variant="outline" disabled={busy || uncertain} onClick={() => void perform(() => call("refresh"))}>Actualizar propuesta y volver a revisar</Button>}
      {open && <p className="mb-4 text-sm text-slate-600">2. Revisa todos los datos. Solo el botón de confirmación registra la operación.{action.expiresAt && <> Válida hasta {new Date(action.expiresAt).toLocaleTimeString("es-CO")}.</>}</p>}
      {editing ? <fieldset disabled={busy || uncertain} className="space-y-4"><TaskFields intent={action.kind === "registrar_gasto" ? "prepare_expense" : "prepare_entry"} fields={fields} setFields={setFields} api={api} /><Button onClick={() => void perform(async () => { update(await api(`/operational-assistants/actions/${action.id}`, "PATCH", { expectedRevision: action.revision, patch: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === "" ? null : v])) }) as Action); setEditing(false); })}>Guardar y volver a revisar</Button></fieldset> : <ResultDetails value={action.preview} />}
      {action.missingFields.length > 0 && open && <p className="mt-3 text-sm text-amber-800">Faltan datos. Usa Corregir propuesta para completarlos.</p>}
      {open && !editing && <div className="mt-5 flex flex-wrap gap-3"><Button disabled={busy || uncertain || action.state !== "lista"} onClick={() => void perform(() => call("confirm"))}>Confirmar {action.kind === "registrar_gasto" ? "registro del gasto" : "entrada de inventario"}</Button><Button variant="outline" disabled={busy || uncertain} onClick={() => setEditing(true)}>Corregir propuesta</Button><Button variant="outline" disabled={busy || uncertain} onClick={() => void perform(() => call("discard"))}>Descartar</Button></div>}
    </>}
  </section>;
}
