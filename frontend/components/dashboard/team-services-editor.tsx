"use client";
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { proxyUrl } from '@/lib/api';
import { tenantQuery,useTenant } from '@/lib/use-tenant';
import { type StaffMember,teamText } from '@/lib/team-editor';
import { Input } from '@/components/ui/input';
import { teamRequest,type EditorSignals } from './team-member-editor';

type ScopeData={scope:'role'|'selected';selected:string[];unavailableCount?:number;services:{id:string;name:string;category:string;active:boolean}[]};
export function TeamServicesEditor({member,onSaved,onDirtyChange,onSavingChange}:Partial<EditorSignals>&{member:StaffMember;onSaved:(member:StaffMember)=>void}) {
  const tenant=useTenant(),lock=useRef(false);
  const [data,setData]=useState<ScopeData|null>(null),[scope,setScope]=useState('role'),[selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[version,setVersion]=useState(0);
  const dirty=Boolean(data && (scope!==data.scope || (scope==='selected' && [...selected].sort().join('|')!==[...data.selected].sort().join('|'))));
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
  useEffect(()=>{onSavingChange?.(busy);return()=>onSavingChange?.(false);},[busy,onSavingChange]);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(proxyUrl(`/api/dashboard/staff/${member.id}/services${tenantQuery(tenant)}`),{signal:controller.signal,cache:'no-store'}).then(async res=>{
      const value=await res.json();if(!res.ok)throw new Error(value.error || 'No se pudieron cargar los servicios.');
      if(!controller.signal.aborted){setData(value);setScope(value.scope);setSelected(value.selected);setError('');}
    }).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'No se pudieron cargar los servicios.');});
    return()=>controller.abort();
  },[member.id,tenant,version]);
  async function save() {
    if(lock.current || (!dirty && !data?.unavailableCount))return;lock.current=true;setBusy(true);setError('');
    try { const result=await teamRequest(`/api/dashboard/staff/${member.id}/services`,tenant,'PUT',{scope,serviceIds:scope==='selected'?selected:[]});onSaved({...member,...result.staff}); }
    catch(cause){setError(cause instanceof Error?cause.message:'No se pudieron guardar los servicios.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <div className="space-y-5"><p className="text-sm text-muted-foreground">Define qué servicios puede atender. Esto no cambia su perfil ni sus permisos de acceso. Después de guardar se revisan las citas afectadas.</p>{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}{!data && <Button variant="outline" onClick={()=>setVersion(v=>v+1)}>Reintentar</Button>}</div>}{!data && !error && <p role="status">Consultando servicios…</p>}{data && <>{Boolean(data.unavailableCount) && <p className="rounded-xl border bg-muted/30 p-4 text-sm">Hay asignaciones anteriores incompatibles con su perfil actual. Al guardar se retirarán esas asignaciones; su historial se conserva.</p>}<fieldset disabled={busy} className="space-y-4"><legend className="mb-3 font-semibold">Servicios que atiende</legend><label className="flex items-start gap-3 rounded-xl border p-4"><input type="radio" name="service-scope" value="role" checked={scope==='role'} onChange={()=>setScope('role')} className="mt-1 accent-teal-700"/><span><span className="font-semibold">Todos los servicios compatibles con su perfil</span><span className="mt-1 block text-sm text-muted-foreground">Incluye los servicios que se incorporen después a su área.</span></span></label><label className="flex items-start gap-3 rounded-xl border p-4"><input type="radio" name="service-scope" value="selected" checked={scope==='selected'} onChange={()=>setScope('selected')} className="mt-1 accent-teal-700"/><span><span className="font-semibold">Solo los servicios seleccionados</span><span className="mt-1 block text-sm text-muted-foreground">Si no seleccionas ninguno, no podrá recibir asignaciones de servicios.</span></span></label>{scope==='selected' && <section className="space-y-3"><label className="block text-sm font-semibold">Buscar servicio<Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ej. consulta o baño" /></label><p className="text-sm text-muted-foreground">{selected.length} servicios seleccionados</p><div className="max-h-72 space-y-2 overflow-y-auto">{data.services.filter(s=>teamText(s.name).includes(teamText(query))).map(s=><label key={s.id} className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={selected.includes(s.id)} disabled={!s.active && !selected.includes(s.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,s.id]:prev.filter(id=>id!==s.id))} className="mt-1 accent-teal-700"/><span><span className="font-semibold">{s.name}</span><span className="block text-muted-foreground">{s.category==='grooming'?'Peluquería':'Veterinaria'}{!s.active?' · Retirado; no permite nuevas citas':''}</span></span></label>)}</div>{!data.services.length && <p className="rounded-xl bg-muted/30 p-4 text-sm">No hay servicios configurados para este perfil.</p>}</section>}</fieldset><Button onClick={()=>void save()} disabled={busy || (!dirty && !data.unavailableCount)}>{busy?'Guardando…':'Guardar servicios'}</Button></>}</div>;
}
