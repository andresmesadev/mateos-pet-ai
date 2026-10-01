"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ExternalLink, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VetPatientContext } from "@/components/dashboard/vet-patient-context";
import { proxyUrl } from "@/lib/api";
import { tenantQuery } from "@/lib/use-tenant";
import { formatPhone } from "@/lib/clients";
import { formatColombiaDateTime, formatStatus } from "@/lib/appointments";
import { formatPetType, getPetEmoji } from "@/lib/pets";
import type { ChatAppointment, ConversationContext } from "@/lib/conversations";

type Props = { conversationId: string; clientId: string; tenant: string | null; onClose: () => void; onProfile: () => void; onAppointment: (petId?: string) => void };
type HistoryPet = { id: string; name: string; kind: "clinical" | "grooming" };
type GroomingNote = { id: string; date: string; serviceName: string | null; groomingNotes: string | null; staffName: string | null };

function GroomingNotes({ petId, tenant }: { petId: string; tenant: string | null }) {
  const [rows, setRows] = useState<GroomingNote[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(()=>{
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(false);
      try {
        const params = new URLSearchParams(tenantQuery(tenant)); if(cursor)params.set("cursor",cursor);
        const response = await fetch(proxyUrl(`/api/dashboard/grooming/pets/${encodeURIComponent(petId)}/notes?${params}`), { cache: "no-store", signal: controller.signal });
        if(!response.ok)throw new Error("Historial no disponible");
        const payload = await response.json() as { visits: GroomingNote[]; nextCursor: string | null };
        if(!Array.isArray(payload.visits))throw new Error("Historial inválido");
        if(!controller.signal.aborted){setRows(previous=>cursor ? [...new Map([...previous,...payload.visits].map(row=>[row.id,row])).values()] : payload.visits);setNext(payload.nextCursor);}
      } catch {if(!controller.signal.aborted)setError(true);}
      finally {if(!controller.signal.aborted)setLoading(false);}
    }
    void load();return ()=>controller.abort();
  },[petId,tenant,cursor,retry]);
  return <div className="space-y-4">{rows.map(row=><article key={row.id} className="rounded-xl border p-4"><h3 className="font-semibold">{row.serviceName || "Peluquería"}</h3><p className="mt-1 text-xs text-muted-foreground">{formatColombiaDateTime(row.date)} · {row.staffName || "Profesional sin asignar"}</p><p className="mt-3 whitespace-pre-wrap text-sm">{row.groomingNotes}</p></article>)}{loading && <p role="status">Cargando notas…</p>}{error && <div role="alert"><p>No se pudo cargar el historial de peluquería.</p><Button variant="outline" className="mt-2" onClick={()=>setRetry(v=>v+1)}>Reintentar</Button></div>}{!loading && !error && !rows.length && <p className="text-sm text-muted-foreground">Esta mascota todavía no tiene notas de peluquería registradas.</p>}{next && <Button variant="outline" disabled={loading} onClick={()=>setCursor(next)}>Ver visitas anteriores</Button>}</div>;
}

function AppointmentContext({ title, rows }: { title: string; rows: ChatAppointment[] }) {
  return <section><h4 className="mb-2 text-sm font-semibold">{title}</h4>{!rows.length ? <p className="text-xs text-muted-foreground">Sin citas registradas en esta sección.</p> : <ul className="space-y-2">{rows.map(row=><li key={row.id} className="rounded-xl border bg-slate-50 p-3 text-xs"><p className="font-semibold">{row.petName} · {row.serviceName}</p><p className="mt-1">{formatColombiaDateTime(row.date)}</p><p className="mt-1 text-muted-foreground">{row.professional || "Profesional sin asignar"}</p><span className="mt-2 inline-block rounded-full bg-white px-2 py-1 font-medium">{formatStatus(row.status)}</span></li>)}</ul>}</section>;
}

export function WhatsAppClientPanel({ conversationId, clientId, tenant, onClose, onProfile, onAppointment }: Props) {
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [wide, setWide] = useState(false);
  const [pet, setPet] = useState<HistoryPet | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const media = window.matchMedia("(min-width: 1536px)");
    const sync = ()=>setWide(media.matches); sync(); media.addEventListener("change",sync);
    return ()=>media.removeEventListener("change",sync);
  },[]);
  useEffect(()=>{if(wide)closeRef.current?.focus();},[wide]);
  useEffect(()=>{
    const controller = new AbortController();
    async function load(background = false) {
      if(!background)setLoading(true);
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/conversations/${encodeURIComponent(conversationId)}/context${tenantQuery(tenant)}`), { cache: "no-store", signal: controller.signal });
        if(!response.ok)throw new Error("Cliente no disponible");
        const payload = await response.json() as ConversationContext;
        if(payload.client?.id !== clientId)throw new Error("Propietario no verificado");
        if(!controller.signal.aborted){setContext(payload);setError(false);}
      } catch {if(!controller.signal.aborted)setError(true);}
      finally {if(!controller.signal.aborted)setLoading(false);}
    }
    void load();const timer = window.setInterval(()=>void load(true),30000);
    return ()=>{controller.abort();window.clearInterval(timer);};
  },[conversationId,clientId,tenant,refresh]);
  const client = context?.client;
  const permissions = context?.permissions;
  const body = <>
    <div className="flex items-center justify-between border-b px-4 py-3"><h3 className="text-sm font-semibold">Cliente, mascotas y citas</h3><Button ref={closeRef} variant="ghost" size="icon" className="size-11 rounded-full" aria-label="Cerrar información del cliente" onClick={onClose}><X className="size-5" /></Button></div>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      {loading ? <><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></> : error || !client || !context ? <div role="alert" className="space-y-3 text-sm"><p>No se pudo cargar la información del cliente.</p><Button variant="outline" onClick={()=>setRefresh(v=>v+1)}>Reintentar</Button></div> : <>
        <div className="text-center"><div aria-hidden className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-[#dfeae6] text-xl font-semibold text-[#406259]">{(client.name || "Cliente").trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()}</div><h4 className="break-words text-lg font-semibold">{client.name || "Cliente sin nombre"}</h4><p className="mt-1 text-sm text-muted-foreground">{formatPhone(client.phone)}</p>{permissions?.canViewClient && <Button variant="outline" className="mt-3 min-h-11 gap-2" onClick={onProfile}><ExternalLink className="size-4" />Ver ficha del cliente</Button>}</div>
        <dl className="space-y-2 border-y py-3 text-xs"><div><dt className="text-muted-foreground">Correo electrónico</dt><dd className="mt-1 break-all">{client.email || "Sin registrar"}</dd></div><div><dt className="text-muted-foreground">Dirección</dt><dd className="mt-1 break-words">{client.address || "Sin registrar"}</dd></div>{client.phoneAlt && <div><dt className="text-muted-foreground">Teléfono alternativo</dt><dd>{formatPhone(client.phoneAlt)}</dd></div>}</dl>
        <AppointmentContext title="Próximas citas" rows={context.upcoming} />
        {context.active.length > 0 && <AppointmentContext title="Atención pendiente o en curso" rows={context.active} />}
        <AppointmentContext title="Última visita atendida" rows={context.lastVisit ? [context.lastVisit] : []} />
        <section aria-label="Mascotas del cliente"><h4 className="mb-3 text-sm font-semibold">Mascotas ({client.pets.length})</h4>{client.pets.length ? <ul className="space-y-3">{client.pets.map(item=><li key={item.id} className="rounded-xl border p-3"><div className="mb-3 flex items-center gap-2.5"><span aria-hidden className="text-2xl">{getPetEmoji(item.type)}</span><div><p className="break-words text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{formatPetType(item.type)}{item.breed ? ` · ${item.breed}` : ""}</p></div></div><div className="flex flex-wrap gap-2">{permissions?.canViewClinical && <Button variant="outline" size="sm" className="min-h-11 text-xs" onClick={()=>setPet({id:item.id,name:item.name,kind:"clinical"})}>Ver expediente de {item.name}</Button>}{permissions?.canViewGrooming && <Button variant="outline" size="sm" className="min-h-11 text-xs" onClick={()=>setPet({id:item.id,name:item.name,kind:"grooming"})}>Notas de peluquería</Button>}{permissions?.canCreateAppointment && <Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={()=>onAppointment(item.id)}>Crear cita para {item.name}</Button>}</div></li>)}</ul> : <p className="text-sm text-muted-foreground">Este propietario todavía no tiene mascotas registradas.</p>}</section>
        {permissions?.canCreateAppointment && <Button className="min-h-11 w-full gap-2" onClick={()=>onAppointment()}><CalendarPlus className="size-4" />Nueva cita</Button>}
        <Button variant="ghost" className="min-h-11 w-full gap-2 text-xs" onClick={()=>setRefresh(v=>v+1)}><RefreshCw className="size-3.5" />Actualizar información</Button>
      </>}
    </div>
    <Dialog open={Boolean(pet)} onOpenChange={open=>{if(!open)setPet(null);}}><DialogContent className="max-h-[90dvh] max-w-[95vw] overflow-y-auto p-5 sm:max-w-3xl"><DialogTitle>{pet?.kind === "clinical" ? "Expediente" : "Historial de peluquería"} de {pet?.name}</DialogTitle><DialogDescription>Consulta los registros guardados de visitas anteriores.</DialogDescription>{pet?.kind === "clinical" && permissions?.canViewClinical && <VetPatientContext key={pet.id} petId={pet.id} appointmentId="" />}{pet?.kind === "grooming" && permissions?.canViewGrooming && <GroomingNotes key={pet.id} petId={pet.id} tenant={tenant} />}</DialogContent></Dialog>
  </>;
  return wide ? <aside aria-label="Información del cliente" className="flex h-full w-80 shrink-0 flex-col border-l bg-white">{body}</aside> : <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent showClose={false} className="left-auto right-0 top-0 flex h-dvh w-[min(100vw,360px)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-none"><DialogTitle className="sr-only">Información del cliente</DialogTitle><DialogDescription className="sr-only">Consulta el propietario, sus mascotas y citas.</DialogDescription>{body}</DialogContent></Dialog>;
}
