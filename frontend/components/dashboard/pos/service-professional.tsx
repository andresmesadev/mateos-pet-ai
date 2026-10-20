"use client";
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { proxyUrl } from '@/lib/api';
import { useTenant } from '@/lib/use-tenant';
import type { CheckoutLine } from '@/lib/pos-checkout';
type Person = { id: string; name: string; role: string };
export function ServiceProfessional({ line, setLines, disabled }: { line: CheckoutLine; setLines: Dispatch<SetStateAction<CheckoutLine[]>>; disabled: boolean }) {
  const tenant = useTenant();
  const [people, setPeople] = useState<Person[]>([]), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const id = line.id, category = line.serviceCategory, serviceId = line.serviceId;
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ serviceId: serviceId ?? '' });
    if (tenant) params.set('tenantId', tenant);
    void fetch(proxyUrl('/api/dashboard/cash/professionals?' + params), { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(); const rows: Person[] = await response.json();
      if (controller.signal.aborted) return;
      setPeople(rows); setError('');
      const preferred = rows.filter(person => person.role === (category === 'grooming' ? 'groomer' : 'vet'));
      if (preferred.length === 1) setLines(current => current.map(value => value.id === id && !value.performedByStaffId ? { ...value, performedByStaffId: preferred[0].id } : value));
    }).catch(() => { if (!controller.signal.aborted) setError('No se pudo cargar el equipo.'); });
    return () => controller.abort();
  }, [tenant, id, category, serviceId, setLines, retry]);
  return <div className="mt-3 rounded-lg border bg-muted/20 p-3"><label className="block text-xs font-semibold">Profesional de {line.description}<select disabled={disabled} value={line.performedByStaffId ?? ''} onChange={event => setLines(current => current.map(value => value.id === id ? { ...value, performedByStaffId: event.target.value } : value))} className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-sm font-normal"><option value="">Selecciona quién realizó el servicio</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><p className="mt-2 text-xs text-muted-foreground">La comisión usa el contrato de esta persona y el valor final de este servicio.</p>{error && <p role="alert" className="mt-2 text-sm">{error} <button type="button" disabled={disabled} className="underline" onClick={() => setRetry(value => value + 1)}>Reintentar</button></p>}</div>;
}
