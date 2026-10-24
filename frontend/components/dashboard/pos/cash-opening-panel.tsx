"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { proxyUrl } from '@/lib/api';
import { formatPosMoney } from '@/lib/pos-checkout';
import { cashAmountValid, readCashOpening, type CashOpeningState } from '@/lib/cash-opening';
import { useDashboardAccess } from '../dashboard-access-provider';

export function CashOpeningPanel({ date, tenant, layout = 'full', disabled = false }: { date: string; tenant?: string; layout?: 'full' | 'checkout'; disabled?: boolean }) {
  const allowed = useDashboardAccess()?.capabilities.administration;
  const [state, setState] = useState<CashOpeningState | null>(null);
  const [amount, setAmount] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false); const [revision, setRevision] = useState(0);
  const path = proxyUrl(`/api/dashboard/cash/opening?date=${date}${tenant ? `&tenantId=${encodeURIComponent(tenant)}` : ''}`);
  useEffect(() => { const refresh = () => setRevision(value => value + 1); window.addEventListener('cash-opening-updated', refresh); return () => window.removeEventListener('cash-opening-updated', refresh); }, []);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    void fetch(path, { cache: 'no-store', signal: controller.signal }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'No se pudo consultar la base.'); return readCashOpening(body, date); }).then(body => { if (!controller.signal.aborted) { setState(body); setAmount(body.opening ? String(body.opening.amount) : body.suggestion ? String(body.suggestion.amount) : ''); setError(''); } }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [allowed, path, date, revision]);
  async function save(event?: FormEvent) {
    event?.preventDefault(); if (!allowed || disabled || saving || !state || state.closed) return;
    const value = Number(amount); if (!amount.trim() || !cashAmountValid(value)) { setError('Indica cuánto efectivo hay al comenzar; puedes escribir 0.'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, amount: value }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'No se pudo guardar la base.');
      const saved = readCashOpening(body, date); if (saved.opening?.amount !== value) throw new Error('No se pudo confirmar el importe guardado.');
      setState(saved); setMessage('Dinero base guardado.'); window.dispatchEvent(new Event('cash-opening-updated'));
    } catch (cause) {
      try { const response = await fetch(path, { cache: 'no-store' }); const verified = readCashOpening(await response.json(), date); if (response.ok && verified.opening?.amount === value) { setState(verified); setMessage('Dinero base guardado.'); window.dispatchEvent(new Event('cash-opening-updated')); return; } } catch { /* Preserve the draft. */ }
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la base.');
    } finally { setSaving(false); }
  }
  if (!allowed) return null;
  const compact = layout === 'checkout';
  const controls = state && !state.closed ? <>
    <label className="block min-w-0 flex-1 text-sm font-medium">Base de efectivo (COP)<input aria-label="Base de efectivo (COP)" type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" required value={amount} disabled={saving || disabled} onChange={event => { setAmount(event.target.value); setMessage(''); }} onKeyDown={compact ? event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); void save(); } } : undefined} placeholder="Escribe 0 si empiezas sin efectivo" className="mt-2 h-11 w-full rounded-md border bg-background px-3" /></label>
    <Button type={compact ? 'button' : 'submit'} className={compact ? 'w-full' : undefined} disabled={saving || disabled} onClick={compact ? () => void save() : undefined}>{saving ? 'Guardando…' : state.opening ? 'Actualizar base' : 'Confirmar base'}</Button>
  </> : null;
  return <section aria-label="Dinero base de caja" className={compact ? 'space-y-3 border-b bg-primary/[0.03] px-5 py-4' : 'space-y-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5'}>
    <div><h3 className={compact ? 'text-sm font-semibold' : 'font-semibold'}>Dinero base de caja</h3><p className={`mt-1 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{compact ? `${date.split('-').reverse().join('/')} · Efectivo inicial, aparte de esta venta.` : 'Efectivo con el que comienza esta jornada. Se registra aparte de las ventas y los ingresos.'}</p></div>
    {!state && !error && <p role="status" className="text-sm">Consultando base…</p>}
    {state?.closed ? <dl className={`grid gap-3 text-sm ${compact ? '' : 'sm:grid-cols-2'}`}><div><dt>Base al abrir</dt><dd className="mt-1 font-semibold">{state.openingCashAmount == null ? 'No registrada en este cierre' : formatPosMoney(state.openingCashAmount)}</dd></div><div><dt>Efectivo dejado para la siguiente jornada</dt><dd className="mt-1 font-semibold">{state.retainedCashAmount == null ? 'No registrado en este cierre' : formatPosMoney(state.retainedCashAmount)}</dd></div></dl> : state && (compact ? <div role="group" aria-label="Confirmar dinero base" className="space-y-3">{controls}</div> : <form onSubmit={save} className="flex flex-wrap items-end gap-3">{controls}</form>)}
    {compact && state?.opening && !state.closed && <p className="text-xs font-medium text-primary">Base guardada: {formatPosMoney(state.opening.amount)}</p>}
    {state?.suggestion && <p className="text-sm text-primary">Sugerido del cierre del {state.suggestion.date.split('-').reverse().join('/')}: {formatPosMoney(state.suggestion.amount)}. Confirma el efectivo disponible antes de guardar.</p>}
    {state && !state.opening && !state.closed && !state.suggestion && <p className="text-xs text-muted-foreground">No hay un cierre anterior con efectivo reservado disponible. Registra la base contada.</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}{error && <div role="alert" className="text-sm text-red-800"><p>{error}</p><Button type="button" variant="outline" disabled={saving || disabled} onClick={() => setRevision(value => value + 1)}>Comprobar base guardada</Button></div>}
  </section>;
}
