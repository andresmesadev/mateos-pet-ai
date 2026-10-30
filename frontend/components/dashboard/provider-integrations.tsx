'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadMetaSignup, runMetaSignup } from '@/lib/whatsapp-signup';

type Setup = { ready: boolean; appId: string; configId: string; version: string };
type Status = { platformAdministrator: boolean; whatsapp: { setup: Setup; connection: null | { status: string; displayPhone: string | null; phoneNumberId: string; routeVersion: number; tokenExpiresAt: string | null } };
  ai: { month: string; enabled: boolean; configured: boolean; policyReady: boolean; limit: number; used: number; reserved: number; remaining: number; exhausted: boolean;
    metering?: { transcriptionUnitsPerMinute: number | null; maxAudioSeconds: number };
    pending: { id: string; operation: string; units: number; createdAt: string }[] } };
const count = (n: number) => n.toLocaleString('es-CO');

export function ProviderIntegrations({ tenantId }: { tenantId: string }) {
  const [status,setStatus] = useState<Status | null>(null), [message,setMessage] = useState(''), [busy,setBusy] = useState(false);
  const [prepared,setPrepared] = useState<{ state: string; config: Setup; client: Awaited<ReturnType<typeof loadMetaSignup>> } | null>(null);
  const [limit,setLimit] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); abort.current = controller; return () => { controller.abort(); }; },[]);
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/proxy/integrations?tenant=${encodeURIComponent(tenantId)}`,{ cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo consultar la conexión. Reintenta o vuelve a iniciar sesión.');
    const value = await response.json() as Status; setStatus(value); return value;
  },[tenantId]);
  useEffect(() => {
    let current = true;
    fetch(`/api/proxy/integrations?tenant=${encodeURIComponent(tenantId)}`,{ cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('No se pudo consultar la conexión. Reintenta o vuelve a iniciar sesión.');
      const value = await response.json() as Status; if (current) setStatus(value);
    }).catch(error => { if (current) setMessage(error.message); });
    return () => { current = false; };
  },[tenantId]);
  async function request(action: string, data: object = {}) {
    const response = await fetch('/api/proxy/integrations',{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, tenantId, ...data }) });
    const value = await response.json();
    if (!response.ok) throw new Error('No se pudo guardar. Revisa el estado y los permisos antes de repetir.');
    return value;
  }
  async function perform(fn: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await fn(); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  }
  function prepare() { void perform(async () => {
    const config = await request('start') as Setup & { state: string };
    const client = await loadMetaSignup(config); setPrepared({ state: config.state, config, client });
    setMessage('Todo listo. Continúa en Meta para elegir la cuenta y el número de este establecimiento.');
  }); }
  function connect() {
    if (!prepared || !abort.current) return;
    // Open synchronously from the click so browsers do not block the popup.
    const result = runMetaSignup(prepared.client,prepared.config,abort.current.signal), state = prepared.state;
    setPrepared(null);
    void perform(async () => { await request('complete',{ state, ...await result }); await refresh(); setMessage('Conexión guardada para este establecimiento.'); });
  }
  const connection = status?.whatsapp.connection, ai = status?.ai;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Cada negocio administra su línea. Los cobros de Meta se pagan directamente a Meta.</p>
      <Button variant="outline" disabled={busy} onClick={() => { void perform(async () => { await refresh(); setMessage('Estado actualizado.'); }); }}>Actualizar estado</Button>
    </div>
    {message && <p role="status" aria-live="polite" className="rounded-xl border border-border bg-muted p-4 text-sm">{message}</p>}
    {!status ? <p>Cargando integraciones…</p> : <div className="grid items-start gap-5 xl:grid-cols-2">
      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><MessageCircle className="size-5 text-primary" aria-hidden="true" />WhatsApp del negocio</h2>
        <div className="rounded-xl bg-muted/60 p-4">
          <p className="font-semibold">{connection?.status === 'enabled' ? 'Conexión registrada' : connection ? 'Desconectado de Huella Nex' : 'Sin conexión comercial registrada'}</p>
          {connection && <p className="mt-1 text-sm">Número: {connection.displayPhone || connection.phoneNumberId}</p>}
          {connection?.tokenExpiresAt && <p className="mt-1 text-sm text-muted-foreground">Autorización hasta: {new Date(connection.tokenExpiresAt).toLocaleDateString('es-CO')}</p>}
        </div>
        {!status.whatsapp.setup.ready && <p className="text-sm text-muted-foreground">La conexión de nuevos negocios aún no está habilitada por la plataforma. Una conexión anterior puede seguir operando con su configuración vigente.</p>}
        <p className="text-sm text-muted-foreground">Alta estándar con Meta. La coexistencia con WhatsApp Business y la importación de conversaciones requieren validación aparte; no migres tu línea habitual desde esta pantalla.</p>
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy || !status.whatsapp.setup.ready} onClick={prepared ? connect : prepare}>{prepared ? 'Continuar en Meta' : connection?.status === 'enabled' ? 'Renovar autorización' : 'Preparar conexión'}</Button>
          {connection?.status === 'enabled' && <Button variant="outline" disabled={busy} onClick={() => { void perform(async () => {
            await request('disconnect',{ expectedVersion: connection.routeVersion }); setPrepared(null); await refresh(); setMessage('Conexión local desactivada. Los mensajes pendientes de esa autorización requieren revisión.');
          }); }}>Desconectar de Huella Nex</Button>}
        </div>
      </section>
      {ai && <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-5 text-primary" aria-hidden="true" />Cupo mensual de IA</h2>
        <p className="text-sm text-muted-foreground">Período {ai.month} · Hora de Colombia. Las unidades son una medida interna de uso; no representan pesos ni cobros adicionales.</p>
        {!ai.enabled || !ai.policyReady ? <p className="rounded-xl bg-muted p-4 text-sm">{!ai.enabled ? 'El control comercial de cupos todavía no está activado.' : 'La plataforma debe revisar la política de consumo antes de habilitar nuevos usos de IA.'}</p>
          : !ai.configured ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">La plataforma debe asignar el cupo de este establecimiento antes de usar la IA.</p>
          : <><dl className="grid grid-cols-2 gap-4 rounded-xl bg-muted/60 p-4">{[['Cupo',ai.limit],['Usado',ai.used],['Reservado',ai.reserved],['Disponible',ai.remaining]].map(([label,value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-xl font-semibold tabular-nums">{count(Number(value))}</dd></div>)}</dl>
            <p role="status" className={ai.exhausted ? 'text-sm font-medium text-amber-800' : 'text-sm text-muted-foreground'}>{ai.exhausted ? 'Cupo agotado: no se harán nuevos consumos de IA. Puedes continuar la atención manual desde el dashboard.' : ai.remaining <= ai.limit * .2 ? 'Queda el 20 % del cupo o menos. No se cobrarán excedentes automáticamente.' : 'Dashboard, agenda, caja e inventario no dependen de este cupo mientras la suscripción esté activa.'}</p></>}
        {ai.enabled && ai.policyReady && ai.metering?.transcriptionUnitsPerMinute != null && <p className="text-sm text-muted-foreground">Transcripción: {count(ai.metering.transcriptionUnitsPerMinute)} créditos por minuto iniciado, hasta {ai.metering.maxAudioSeconds / 60} minutos por audio. El procesamiento del texto se cuenta aparte. Los mensajes con mucho historial pueden consumir varios créditos.</p>}
        {status.platformAdministrator && <form className="space-y-3 border-t border-border pt-4" onSubmit={event => { event.preventDefault(); void perform(async () => { await request('limit',{ monthlyLimit: Number(limit) }); setLimit(''); await refresh(); setMessage('Cupo actualizado con auditoría.'); }); }}>
          <label className="block text-sm font-semibold" htmlFor="monthly-ai-limit">Cupo asignado por la plataforma</label>
          <input id="monthly-ai-limit" className="h-11 w-full rounded-lg border border-border px-3" inputMode="numeric" type="number" min="0" max="1000000000" step="1" required value={limit} onChange={e => setLimit(e.target.value)} />
          <Button disabled={busy || !limit} type="submit">Guardar cupo mensual</Button>
        </form>}
        {ai.pending.length > 0 && <div className="space-y-4 border-t border-border pt-4"><h3 className="font-semibold">Consumos por conciliar</h3><p className="text-sm text-muted-foreground">El resultado o la duración del consumo requieren comprobación. Estas unidades permanecen reservadas hasta comprobar el consumo.</p>
          {ai.pending.map(entry => <div key={entry.id} className="space-y-3 rounded-xl border border-border p-3"><p className="text-sm">{entry.operation} · {count(entry.units)} unidades · {new Date(entry.createdAt).toLocaleDateString('es-CO')}</p>
            {status.platformAdministrator && <form className="space-y-2" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void perform(async () => { await request('reconcile',{ entryId: entry.id, accepted: form.get('accepted') === 'yes', receiptRef: form.get('receiptRef') }); await refresh(); setMessage('Conciliación guardada con su referencia.'); }); }}>
              <label className="block text-sm">Referencia de comprobación del proveedor<input name="receiptRef" required maxLength={256} className="mt-1 h-10 w-full rounded-lg border border-border px-3" /></label>
              <label className="block text-sm">Resultado comprobado<select name="accepted" className="mt-1 h-10 w-full rounded-lg border border-border px-3"><option value="yes">Consumo aceptado</option><option value="no">Consumo rechazado</option></select></label>
              <Button type="submit" variant="outline" disabled={busy}>Guardar conciliación</Button>
            </form>}</div>)}
        </div>}
      </section>}
    </div>}
  </div>;
}
