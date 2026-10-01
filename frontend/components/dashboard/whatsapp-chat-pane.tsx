"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, CalendarPlus, ChevronDown, ChevronUp, Copy, Search, Send, Smile, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ClientSheet } from "@/components/dashboard/client-sheet";
import { NewAppointmentDialog } from "@/components/dashboard/new-appointment-dialog";
import { WhatsAppClientPanel } from "@/components/dashboard/whatsapp-client-panel";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { tenantQuery } from "@/lib/use-tenant";
import { type ConversationDetail, type ConversationMessage, formatPhone } from "@/lib/conversations";
import { matchingMessageIds, messageAuthorLabel, messageDay, mergeThreadMessages } from "@/lib/whatsapp-workspace";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type Props = {
  conversationId: string;
  tenant: string | null;
  drafts: Record<string, string>;
  busyThreads: Record<string, boolean>;
  onDraft: (key: string, text: string, expected?: string) => void;
  onBusy: (key: string, busy: boolean) => void;
  onBack: () => void;
  onChanged: () => void;
};

export function WhatsAppChatPane({ conversationId, tenant, drafts, busyThreads, onDraft, onBusy, onBack, onChanged }: Props) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [confirmTakeOver, setConfirmTakeOver] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [appointmentPetId, setAppointmentPetId] = useState<string>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageQuery, setMessageQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [newMessages, setNewMessages] = useState(0);
  const knownMessages = useRef<Set<string> | null>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const panelButton = useRef<HTMLButtonElement>(null);
  const emojiSelection = useRef({ start: 0, end: 0 });
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const firstScroll = useRef(true);
  const sendLock = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  const conversation = detail?.conversation;
  const canSend = detail?.viewer?.isMine === true;
  const draftKey = conversation ? `${conversation.tenantId ?? tenant ?? "current"}:${conversation.userId}` : "";
  const text = drafts[draftKey] ?? "";
  const sending = busyThreads[draftKey] ?? false;
  const matches = matchingMessageIds(detail?.messages ?? [], messageQuery);
  const activeMatch = matches[matchIndex % Math.max(1, matches.length)];

  useEffect(() => {
    const input = inputRef.current;
    if (input) { input.style.height = "auto"; input.style.height = `${Math.min(128, Math.max(46, input.scrollHeight + 2))}px`; }
  }, [text, loading]);

  useEffect(() => {
    if (searchOpen && activeMatch) {
      nearBottom.current = false;
      const container = scrollRef.current;
      const message = messageRefs.current.get(activeMatch);
      if (container && message) container.scrollTop += message.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientHeight / 2 + message.clientHeight / 2;
    }
  }, [searchOpen, activeMatch]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (container && nearBottom.current && !searchOpen) container.scrollTop = container.scrollHeight;
  }, [panelOpen, searchOpen]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function load(background: boolean) {
      if (busy) return;
      busy = true;
      if (!background) setLoading(true);
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/conversations/${encodeURIComponent(conversationId)}/messages${tenantQuery(tenant)}`), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 404 ? "Esta conversación no está disponible en el establecimiento seleccionado." : "No se pudo actualizar el chat. Puedes reintentar la carga.");
        const data = await response.json() as ConversationDetail;
        if (!data.conversation?.userId || !Array.isArray(data.messages)) throw new Error("No se pudo verificar el propietario de la conversación.");
        if (controller.signal.aborted) return;
        setDetail((current) => current ? { ...data, ...(current.conversation.controlVersion > data.conversation.controlVersion ? { conversation: current.conversation, viewer: current.viewer } : {}), messages: mergeThreadMessages(current.messages, data.messages) } : data);
        setLoadError(null);
      } catch (cause) {
        if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "No se pudo cargar el chat.");
      } finally {
        busy = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load(false);
    const interval = window.setInterval(() => void load(true), 5000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [conversationId, tenant, refresh]);

  useEffect(() => {
    if (loading || !detail) return;
    const ids = new Set(detail.messages.map(message=>message.id));
    const added = knownMessages.current ? detail.messages.filter(message=>!knownMessages.current!.has(message.id) && message.role === "user").length : 0;
    knownMessages.current = ids;
    if (added && !nearBottom.current) {
      // La llegada de mensajes del servidor actualiza el aviso sin mover la lectura.
      setNewMessages(value=>value+added);
    }
    if (!searchOpen && (firstScroll.current || nearBottom.current)) {
      const container = scrollRef.current;
      if (container) container.scrollTop = container.scrollHeight;
      firstScroll.current = false;
    }
  }, [loading, detail, searchOpen]);

  function closePanel() {
    setPanelOpen(false);
    window.requestAnimationFrame(()=>panelButton.current?.focus());
  }

  function jumpToLatest() {
    setSearchOpen(false); setMessageQuery(""); setNewMessages(0); setShowJump(false);
    nearBottom.current = true;
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }

  function insertEmoji(emoji: string) {
    const { start, end } = emojiSelection.current;
    const next = text.slice(0, start) + emoji + text.slice(end);
    if (next.length > 4096) { toast("El mensaje admite hasta 4096 caracteres.", "error"); return; }
    onDraft(draftKey, next); setSendError(null); setEmojiOpen(false);
    window.requestAnimationFrame(()=> { inputRef.current?.focus(); inputRef.current?.setSelectionRange(start + emoji.length, start + emoji.length); });
  }

  async function copyMessage(content: string) {
    try { await navigator.clipboard.writeText(content); toast("Mensaje copiado.", "success"); }
    catch { toast("No se pudo copiar. Puedes seleccionar el texto del mensaje.", "error"); }
  }

  async function send() {
    const submitted = text.trim();
    if (!submitted || !canSend || !conversation || sending || sendLock.current || resolving || loading || loadError) return;
    const targetId = conversation.id;
    sendLock.current = true; onBusy(draftKey, true); setSendError(null);
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/conversations/${encodeURIComponent(targetId)}/send${tenantQuery(tenant)}`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: submitted, expectedVersion: conversation.controlVersion }) });
      const data = await response.json().catch(() => null) as { message?: ConversationMessage; error?: string } | null;
      if (!response.ok || !data?.message) throw new Error(data?.error || "No se pudo enviar el mensaje. El borrador se conserva.");
      onDraft(draftKey, "", submitted); onChanged();
      if (!mounted.current) return;
      nearBottom.current = true;
      setDetail((current) => current ? { ...current, messages: mergeThreadMessages(current.messages, [data.message!]) } : current);
      toast("Mensaje enviado por WhatsApp.", "success");
    } catch (cause) {
      if (mounted.current) { setSendError(cause instanceof Error ? cause.message : "No se pudo enviar. El borrador se conserva."); setRefresh(value=>value+1); }
    } finally {
      sendLock.current = false; onBusy(draftKey, false);
      if (mounted.current) inputRef.current?.focus();
    }
  }

  async function changeControl(action: "take" | "release", takeOver = false) {
    if (!conversation || resolving || sending || loadError) return;
    setResolving(true);
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/conversations/${encodeURIComponent(conversation.id)}/control${tenantQuery(tenant)}`), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedVersion: conversation.controlVersion, takeOver }),
      });
      const payload = await response.json() as ConversationDetail & { error?: string };
      if (!response.ok || !payload.conversation) throw new Error(payload.error || "No se pudo cambiar quién atiende. Actualiza el chat.");
      if (!mounted.current) return;
      setDetail(current=>({ ...payload, messages: mergeThreadMessages(current?.messages ?? [], payload.messages) }));
      setConfirmResolve(false); setConfirmTakeOver(false); onChanged();
      toast(action === "take" ? "Estás atendiendo esta conversación. La IA está pausada." : "Conversación devuelta a la IA.", "success");
    } catch (cause) {
      if (mounted.current) { toast(cause instanceof Error ? cause.message : "No se pudo actualizar la atención.", "error"); setRefresh(value=>value+1); }
    } finally { if (mounted.current) setResolving(false); }
  }

  const messages = detail?.messages ?? [];
  const displayName = conversation?.name || formatPhone(conversation?.phone ?? null);
  return <div className="flex h-full min-w-0">
    <div className="relative flex min-w-0 flex-1 flex-col">
    <header className="shrink-0 border-b border-[#d9dfdc] bg-[#f0f2f5] px-2 py-2 sm:px-4">
      <div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full md:hidden" aria-label="Volver a conversaciones" onClick={onBack}><ArrowLeft className="size-5" /></Button><div aria-hidden className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-[#dfeae6] text-[#406259] sm:flex"><UserRound className="size-5" /></div><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold" title={displayName}>{loading && !detail ? "Cargando conversación…" : displayName}</h2>{conversation && <p className={cn("mt-0.5 text-xs", conversation.requires_human_attention ? "text-amber-800" : "text-[#54656f]")}>{conversation.assignment ? `Atiende ${conversation.assignment.name}` : conversation.requires_human_attention ? "Equipo pendiente · IA pausada" : conversation.status === "cerrada" ? "Conversación cerrada" : "Responde el asistente IA"}</p>}</div><Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" aria-label="Buscar en el chat" aria-expanded={searchOpen} disabled={!conversation || Boolean(loadError)} onClick={()=>setSearchOpen(value=>!value)}><Search className="size-5" /></Button><Button ref={panelButton} variant="ghost" size="icon" className={cn("size-11 shrink-0 rounded-full",panelOpen&&"bg-[#d9fdd3]")} aria-label="Cliente y mascotas" title="Cliente y mascotas" aria-expanded={panelOpen} disabled={!conversation || Boolean(loadError)} onClick={()=>setPanelOpen(value=>!value)}><UserRound className="size-5" /></Button>{detail?.viewer?.canCreateAppointment && <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" aria-label="Nueva cita" title="Nueva cita" disabled={!conversation || Boolean(loadError)} onClick={()=>{setAppointmentPetId(undefined);setAppointmentOpen(true);}}><CalendarPlus className="size-5" /></Button>}</div>
    </header>
    {searchOpen && <section aria-label="Buscar mensajes" className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-white px-3 py-2"><Input autoFocus aria-label="Buscar en esta conversación" placeholder="Buscar un mensaje…" value={messageQuery} onChange={event=>{setMessageQuery(event.target.value);setMatchIndex(0);}} className="min-h-11 min-w-0 flex-1 basis-28 rounded-full bg-[#f0f2f5]" /><span role="status" className="px-1 text-xs text-muted-foreground">{messageQuery.trim() ? matches.length ? `${matchIndex % matches.length + 1} de ${matches.length}` : "Sin resultados" : "Busca una palabra"}</span><Button variant="ghost" size="icon" className="size-11" aria-label="Resultado anterior" disabled={!matches.length} onClick={()=>setMatchIndex(value=>(value-1+matches.length)%matches.length)}><ChevronUp className="size-4" /></Button><Button variant="ghost" size="icon" className="size-11" aria-label="Siguiente resultado" disabled={!matches.length} onClick={()=>setMatchIndex(value=>(value+1)%matches.length)}><ChevronDown className="size-4" /></Button><Button variant="ghost" size="icon" className="size-11" aria-label="Cerrar búsqueda de mensajes" onClick={()=>{setSearchOpen(false);setMessageQuery("");}}><X className="size-4" /></Button></section>}
    {loadError && <div role="alert" className="shrink-0 border-b bg-amber-50 p-3 text-sm text-amber-950"><p>{loadError}</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => setRefresh((value) => value + 1)}>Reintentar carga del chat</Button></div>}
    {conversation && <section aria-label="Responsable de la conversación" className={cn("flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2", conversation.requires_human_attention ? "border-amber-200 bg-amber-50" : "bg-white")}>
      <div className="min-w-0 flex-1 basis-40"><p className="text-xs font-semibold">{canSend ? "Estás atendiendo este chat" : conversation.assignment ? `Atiende ${conversation.assignment.name}` : conversation.requires_human_attention ? "El cliente necesita ayuda del equipo" : "Asistente IA activo"}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{conversation.requires_human_attention ? "La IA está pausada hasta devolverle la conversación." : "Pulsa Atender yo para responder personalmente."}</p></div>
      {!canSend && <Button variant="outline" className="min-h-11 shrink-0 bg-white px-3 text-xs" disabled={resolving || sending || Boolean(loadError) || Boolean(conversation.assignment && !detail?.viewer?.canTakeOver)} onClick={()=>conversation.assignment ? setConfirmTakeOver(true) : void changeControl("take")}>{resolving ? "Actualizando…" : conversation.assignment ? "Atender en su lugar" : "Atender yo"}</Button>}
      {conversation.requires_human_attention && detail?.viewer?.canRelease && <Button variant="outline" className="min-h-11 shrink-0 bg-white px-3 text-xs" disabled={resolving || sending || Boolean(loadError)} onClick={()=>setConfirmResolve(true)}>Devolver a la IA</Button>}
    </section>}
    <div ref={scrollRef} role="region" aria-label="Historial de mensajes" className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-[#efeae2] p-3 sm:px-6" onScroll={() => { const container = scrollRef.current; if (container) { nearBottom.current = container.scrollHeight - container.scrollTop - container.clientHeight < 80; setShowJump(!nearBottom.current); if(nearBottom.current)setNewMessages(0); } }}>
      {loading && !detail ? <div className="space-y-4">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-16 w-3/4" />)}</div> : !messages.length ? <p className="py-10 text-center text-sm text-muted-foreground">{loadError ? "El historial no está disponible." : "No hay mensajes registrados en esta conversación."}</p> : messages.map((message, index) => {
        const outgoing = message.role === "assistant";
        const day = messageDay(message.createdAt);
        return <div key={message.id} ref={element=>{if(element)messageRefs.current.set(message.id,element);else messageRefs.current.delete(message.id);}}>{(!index || messageDay(messages[index - 1].createdAt) !== day) && <p className="my-4 text-center"><time className="inline-block rounded-lg bg-white/90 px-3 py-1.5 text-[11px] text-[#54656f] shadow-sm" dateTime={message.createdAt}>{day}</time></p>}<div className={cn("flex", outgoing && "justify-end")}><div className={cn("group relative max-w-[95%] rounded-lg px-3 py-2 text-sm text-[#172b28] shadow-sm sm:max-w-[85%]", outgoing ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white", searchOpen && activeMatch === message.id && "ring-2 ring-amber-500", searchOpen && matches.includes(message.id) && "bg-amber-100")}><p className="whitespace-pre-wrap break-words pr-7 leading-relaxed [overflow-wrap:anywhere]">{message.content}</p><Button variant="ghost" size="icon" className="absolute right-0 top-0 size-11 rounded-lg opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" aria-label={`Copiar mensaje ${index+1}`} title="Copiar mensaje" onClick={()=>void copyMessage(message.content)}><Copy className="size-3.5" /></Button><p className="mt-1 text-right text-[10px] text-[#54656f]">{messageAuthorLabel(message)} · <time dateTime={message.createdAt}>{new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt))}</time></p></div></div></div>;
      })}
    </div>
    {(showJump || newMessages > 0) && <div className="pointer-events-none absolute bottom-28 right-4 z-10"><Button variant="outline" className="pointer-events-auto min-h-11 gap-2 rounded-full bg-white shadow-md" onClick={jumpToLatest}><ArrowDown className="size-4" />{newMessages ? `${newMessages} ${newMessages===1?"mensaje nuevo":"mensajes nuevos"}` : "Ir al último mensaje"}</Button><span role="status" className="sr-only">{newMessages ? `${newMessages} mensajes nuevos en la conversación` : ""}</span></div>}
    <footer className="shrink-0 space-y-2 border-t border-[#d9dfdc] bg-[#f0f2f5] px-2 py-2 sm:px-4">
      {sendError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{sendError} Puedes volver a pulsar Enviar; el texto no se ha borrado.</p>}
      <label htmlFor="whatsapp-reply" className="sr-only">Respuesta al cliente</label>
      <div className="flex items-end gap-1.5"><Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" aria-label="Insertar emoji" disabled={!conversation || sending || loading || resolving || Boolean(loadError)} onClick={()=>{emojiSelection.current={start:inputRef.current?.selectionStart??text.length,end:inputRef.current?.selectionEnd??text.length};setEmojiOpen(true);}}><Smile className="size-5" /></Button><textarea id="whatsapp-reply" ref={inputRef} rows={1} maxLength={4096} placeholder="Escribe un mensaje" aria-describedby="whatsapp-draft-help" value={text} disabled={!conversation || sending || loading || resolving || Boolean(loadError)} onChange={(event) => { onDraft(draftKey, event.target.value); setSendError(null); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-transparent bg-white px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60" /><Button className="size-11 shrink-0 rounded-full bg-[#008069] p-0 text-white hover:bg-[#006c59]" aria-label={sending ? "Enviando mensaje" : "Enviar mensaje"} title="Enviar mensaje" disabled={!conversation || !canSend || !text.trim() || sending || resolving || loading || Boolean(loadError)} onClick={() => void send()}><Send className="size-5" /></Button></div>
      <p id="whatsapp-draft-help" className="px-1 text-[10px] leading-relaxed text-[#54656f]">{canSend ? "Responderás con tu nombre. Enter envía · Shift + Enter agrega una línea." : "Puedes preparar un borrador; toma la conversación para enviarlo."} El borrador se conserva durante esta visita.</p>
    </footer>
    </div>
    {conversation && panelOpen && <WhatsAppClientPanel conversationId={conversation.id} clientId={conversation.userId} tenant={tenant} onClose={closePanel} onProfile={()=>{setPanelOpen(false);setClientOpen(true);}} onAppointment={petId=>{setPanelOpen(false);setAppointmentPetId(petId);setAppointmentOpen(true);}} />}
    {conversation && detail?.viewer?.role === "admin" && <ClientSheet clientId={conversation.userId} open={clientOpen} onOpenChange={setClientOpen} />}
    {conversation && detail?.viewer?.canCreateAppointment && appointmentOpen && <NewAppointmentDialog initialClientId={conversation.userId} initialPetId={appointmentPetId} initialDate={new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })} onClose={() => setAppointmentOpen(false)} onCreated={() => { setAppointmentOpen(false); toast("Cita creada para este cliente.", "success"); }} />}
    <Dialog open={emojiOpen} onOpenChange={setEmojiOpen}><DialogContent className="max-w-[95vw] p-5 sm:max-w-sm"><DialogTitle>Elige un emoji</DialogTitle><DialogDescription>Se insertará en tu mensaje; podrás revisarlo antes de enviar.</DialogDescription><div className="grid grid-cols-6 gap-1">{["😊","🙂","👋","👍","❤️","🙏","🐶","🐱","🐾","🦴","🛁","✂️","📅","⏰","✅","📍","☀️","⭐","💚","🥰","😃","🎉","💬","🤗"].map(emoji=><button key={emoji} type="button" aria-label={`Insertar ${emoji}`} className="flex min-h-11 items-center justify-center rounded-lg text-2xl hover:bg-[#d9fdd3] focus-visible:outline-2 focus-visible:outline-primary" onClick={()=>insertEmoji(emoji)}>{emoji}</button>)}</div></DialogContent></Dialog>
    <Dialog open={confirmResolve} onOpenChange={(open) => { if (!resolving) setConfirmResolve(open); }}><DialogContent showClose={!resolving} className="max-w-[95vw] space-y-4 p-6 sm:max-w-lg"><DialogTitle>Devolver conversación a la IA</DialogTitle><DialogDescription>El asistente podrá responder a los próximos mensajes del cliente. Termina tu atención antes de confirmar. Tu borrador se conserva.</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" disabled={resolving} onClick={() => setConfirmResolve(false)}>Seguir atendiendo</Button><Button disabled={resolving} onClick={() => void changeControl("release")}>{resolving ? "Resolviendo…" : "Devolver a la IA"}</Button></div></DialogContent></Dialog>
    <Dialog open={confirmTakeOver} onOpenChange={open=>{if(!resolving)setConfirmTakeOver(open);}}><DialogContent showClose={!resolving} className="max-w-[95vw] space-y-4 p-6 sm:max-w-lg"><DialogTitle>Cambiar responsable del chat</DialogTitle><DialogDescription>{conversation?.assignment?.name} está atendiendo. Al confirmar, pasarás a ser el responsable y esa persona dejará de poder enviar mensajes en este chat.</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" disabled={resolving} onClick={()=>setConfirmTakeOver(false)}>Cancelar</Button><Button disabled={resolving} onClick={()=>void changeControl("take", true)}>Atender en su lugar</Button></div></DialogContent></Dialog>
  </div>;
}
