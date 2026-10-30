'use client';
import { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { proxyUrl } from '@/lib/api';
import { parseServiceStatus, SERVICE_STATES, type ServiceStatus } from '@/lib/service-status';

export function ServiceStatusPanel({ tenantId }: { tenantId: string }) {
  const [result, setResult] = useState<ServiceStatus | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    async function load() {
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/service-status?tenantId=${encodeURIComponent(tenantId)}`), { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Status unavailable');
        const data = parseServiceStatus(await response.json(), tenantId);
        if (!controller.signal.aborted) setResult(data);
      } catch {
        if (!disposed) setError(true);
      } finally { clearTimeout(timeout); }
    }
    let disposed = false;
    void load();
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [tenantId, attempt]);
  const loading = !result && !error;
  return <section aria-labelledby="service-status-heading" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="service-status-heading" className="flex items-center gap-2 font-semibold"><Activity className="size-5 text-primary" aria-hidden="true" />Estado del servicio</h2>
      <Button variant="outline" className="min-h-11" disabled={loading} onClick={() => { setResult(null); setError(false); setAttempt(n => n + 1); }}><RefreshCw className="mr-2 size-4" aria-hidden="true" />Actualizar estado</Button>
    </div>
    <div aria-live="polite">
      {loading ? <p role="status" className="mt-3 text-sm text-muted-foreground">Consultando el estado de este negocio…</p> : error ?
        <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">No se pudo comprobar el servicio. Actualiza el estado; si persiste, avisa a soporte. Si un cobro quedó sin respuesta, revisa su historial antes de repetirlo.</p> : result && <>
          <p className="mt-2 text-xs text-muted-foreground">Consulta del {new Date(result.checkedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · Hora de Colombia. No es un monitor en tiempo real.</p>
          <dl className="mt-4 grid gap-2 lg:grid-cols-3">
            <div className="grid grid-cols-2 items-center gap-2 rounded-xl bg-muted/40 p-3 lg:block"><dt className="text-sm text-muted-foreground">Dashboard manual</dt><dd className="text-sm font-semibold lg:mt-1">Responde a esta consulta</dd></div>
            {(['whatsapp', 'ai'] as const).map(kind => {
              const [title] = kind === 'whatsapp' ? SERVICE_STATES.whatsapp[result.whatsapp.state] : SERVICE_STATES.ai[result.ai.state];
              return <div key={kind} className="grid grid-cols-2 items-center gap-2 rounded-xl bg-muted/40 p-3 lg:block"><dt className="text-sm text-muted-foreground">{kind === 'whatsapp' ? 'WhatsApp' : 'Inteligencia artificial'}</dt><dd className="text-sm font-semibold lg:mt-1">{title}</dd></div>;
            })}
          </dl>
          <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-medium text-primary">Qué significa este estado</summary><div className="space-y-3 pb-2 text-muted-foreground">
            <p><strong>Operación manual:</strong> no depende de WhatsApp ni del cupo de IA. Conserva los permisos de tu cuenta; verifica cada guardado.</p>
            <p><strong>WhatsApp:</strong> {SERVICE_STATES.whatsapp[result.whatsapp.state][1]}</p>
            <p><strong>IA:</strong> {SERVICE_STATES.ai[result.ai.state][1]}</p>
            {result.ai.observedAt && <p className="text-xs">Sondeo de IA: {new Date(result.ai.observedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>}
          </div></details>
        </>}
    </div>
  </section>;
}
