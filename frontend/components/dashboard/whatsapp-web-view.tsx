"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle, RefreshCw, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { proxyUrl } from "@/lib/api";
import { useTenant } from "@/lib/use-tenant";
import { type ConversationsResponse, type DashboardConversation, formatPhone } from "@/lib/conversations";
import { threadDateLabel, uniqueThreads } from "@/lib/whatsapp-workspace";
import { cn } from "@/lib/utils";
import { useWorkspaceIdentity } from "@/lib/use-list-continuity";
import { useWhatsAppDrafts } from "@/lib/use-whatsapp-drafts";
import { WhatsAppChatPane } from "@/components/dashboard/whatsapp-chat-pane";

function WhatsAppWorkspace({ initialConversationId, tenant }: { initialConversationId: string | null; tenant: string | null }) {
  const params = useSearchParams();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState<DashboardConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [requestedId, setRequestedId] = useState(initialConversationId);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [attention, setAttention] = useState<"all" | "human">(() => params.get("attention") === "human" ? "human" : "all");
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const { drafts, recovered, onDraft, storageFailed } = useWhatsAppDrafts();
  const [busyThreads, setBusyThreads] = useState<Record<string, boolean>>({});

  useLayoutEffect(() => {
    const fit = () => {
      const element = workspaceRef.current;
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY;
      const bottomPadding = Number.parseFloat(window.getComputedStyle(element.closest("main") ?? element).paddingBottom) || 0;
      const height = `${Math.max(360, (window.visualViewport?.height ?? window.innerHeight) - top - bottomPadding - 16)}px`;
      if (element.style.height !== height) element.style.height = height;
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    const observer = new ResizeObserver(fit);
    const main = workspaceRef.current?.closest("main");
    if (main) observer.observe(main);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit); };
  }, []);

  // Mantener borradores cuando un enlace interno cambia el chat solicitado.
  if (requestedId !== initialConversationId) {
    setRequestedId(initialConversationId);
    setSelectedId(initialConversationId);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPages(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function load(background: boolean) {
      if (busy) return;
      busy = true;
      if (!background) setLoading(true);
      try {
        const results: ConversationsResponse[] = [];
        for (let page = 1; page <= pages; page++) {
          const params = new URLSearchParams({ page: String(page), limit: "25" });
          if (tenant) params.set("tenantId", tenant);
          if (query) params.set("search", query);
          if (attention === "human") params.set("attention", "human");
          const response = await fetch(proxyUrl(`/api/dashboard/conversations?${params}`), { cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error("No se pudieron actualizar las conversaciones. Intenta de nuevo.");
          const payload = await response.json() as ConversationsResponse;
          results.push(payload);
          if (page >= payload.pagination.totalPages) break;
        }
        if (controller.signal.aborted) return;
        setConversations(uniqueThreads(results.flatMap((result) => result.data)));
        setTotal(results[0]?.pagination.total ?? 0);
        setTotalPages(results[0]?.pagination.totalPages ?? 1);
        setError(null);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar la bandeja.");
      } finally {
        busy = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load(false);
    const interval = window.setInterval(() => void load(true), 10000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [tenant, query, attention, pages, refresh]);

  useEffect(() => {
    if (!Object.values(drafts).some((text) => text.trim())) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [drafts]);

  return <div ref={workspaceRef} className="relative flex h-[calc(100dvh-190px)] min-h-[360px] min-w-0 overflow-hidden rounded-xl border border-[#d9dfdc] bg-white shadow-sm">
    <section aria-label="Bandeja de conversaciones" className={cn("flex w-full shrink-0 flex-col border-r border-[#d9dfdc] md:w-72 2xl:w-80", selectedId && "hidden md:flex")}>
      <div className="space-y-3 border-b border-[#e9eeeb] p-4">
        <div className="flex items-center justify-between gap-2"><div><h2 className="text-xl font-bold tracking-tight">Chats</h2><p className="text-xs text-muted-foreground">{total} {total === 1 ? "conversación" : "conversaciones"}</p></div><Button variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-full" aria-label="Actualizar conversaciones" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw className={cn("size-4", loading && "animate-spin")} /></Button></div>
        <div className="relative"><Search aria-hidden className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input aria-label="Buscar cliente o teléfono" placeholder="Buscar un chat" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 rounded-full border-transparent bg-[#f0f2f5] pl-9" /></div>
        <div role="group" aria-label="Filtrar conversaciones" className="flex gap-2">{([{value:"all", label:"Todas"}, {value:"human", label:"Atención humana"}] as const).map((filter) => <button key={filter.value} type="button" aria-pressed={attention === filter.value} onClick={() => { setAttention(filter.value); setPages(1); }} className={cn("min-h-11 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary", attention === filter.value ? "bg-[#d9fdd3] text-[#176b43]" : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]")}>{filter.label}</button>)}</div>
      </div>
      {error && <div role="alert" className="border-b bg-amber-50 p-3 text-sm text-amber-950"><p>{error}</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => setRefresh((value) => value + 1)}>Reintentar</Button></div>}
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={loading}>
        {loading ? <div className="space-y-4 p-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full rounded-lg" />)}</div> : error ? null : !conversations.length ? <div role="status" className="flex h-full flex-col items-center justify-center gap-3 px-5 py-8 text-center"><MessageCircle className="size-8 text-teal-700" /><h3 className="font-semibold">{query ? "Sin coincidencias" : attention === "human" ? "Sin chats en atención humana" : "Tu bandeja está lista"}</h3><p className="text-sm text-muted-foreground">{query ? "Prueba con otro nombre o teléfono." : attention === "human" ? "Los chats solicitados o tomados por el equipo aparecerán aquí." : "Las conversaciones recibidas por WhatsApp aparecerán aquí."}</p>{query && <Button variant="outline" onClick={() => setSearch("")}>Limpiar búsqueda</Button>}</div> : <ul>{conversations.map((conversation) => <li key={conversation.userId}>
          <button type="button" aria-pressed={conversation.id === selectedId} aria-label={`Abrir conversación de ${conversation.name || formatPhone(conversation.phone)}`} onClick={() => setSelectedId(conversation.id)} className={cn("flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#f5f6f6] focus-visible:outline-2 focus-visible:outline-primary", conversation.id === selectedId && "bg-[#e9edef] shadow-[inset_3px_0_0_#008069]")}>
            <div aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#dfeae6] font-semibold text-[#406259]">{conversation.name ? conversation.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase() : <UserRound className="size-5" />}</div><div className="min-w-0 flex-1 border-b border-[#eef0ef] pb-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold" title={conversation.name || formatPhone(conversation.phone)}>{conversation.name || formatPhone(conversation.phone)}</span><time dateTime={conversation.lastMessageAt ?? undefined} className="shrink-0 text-[11px] text-muted-foreground">{threadDateLabel(conversation.lastMessageAt)}</time></div><p className="mt-1 truncate text-xs text-muted-foreground">{conversation.lastMessage || "Sin mensajes"}</p>{conversation.requires_human_attention && <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-800"><span className="size-1.5 rounded-full bg-amber-500" />{conversation.assignment ? `Atiende ${conversation.assignment.name}` : "Necesita atención"}</span>}</div>
          </button></li>)}</ul>}
      </div>
      {!error && <div className="border-t p-3 text-center"><p className="text-xs text-muted-foreground">{loading ? "Actualizando…" : `${conversations.length} de ${total} conversaciones`}</p>{pages < totalPages && <Button variant="outline" className="mt-2 min-h-11 w-full" disabled={loading} onClick={() => setPages((value) => value + 1)}>Cargar conversaciones anteriores</Button>}</div>}
    </section>
    <section aria-label="Chat seleccionado" className={cn("min-w-0 flex-1", !selectedId && "hidden md:block")}>
      {selectedId ? <WhatsAppChatPane key={selectedId} conversationId={selectedId} tenant={tenant} drafts={drafts} recoveredDrafts={recovered} storageFailed={storageFailed} busyThreads={busyThreads} onDraft={onDraft} onBusy={(key, busy) => setBusyThreads((current) => ({ ...current, [key]: busy }))} onBack={() => setSelectedId(null)} onChanged={() => setRefresh((value) => value + 1)} /> : <div className="flex h-full flex-col items-center justify-center gap-4 border-b-4 border-[#25d366] bg-[#f0f2f5] p-6 text-center"><div className="rounded-full bg-[#dfeae6] p-6 text-[#008069]"><MessageCircle className="size-12" /></div><h2 className="text-2xl font-semibold tracking-tight">WhatsApp de tu centro</h2><p className="max-w-sm text-sm leading-relaxed text-[#54656f]">Selecciona un chat para conversar con el propietario y consultar sus mascotas y próximas visitas.</p></div>}
    </section>
  </div>;
}

export function WhatsAppWebView({ initialConversationId = null }: { initialConversationId?: string | null }) {
  const tenant = useTenant();
  const { owner } = useWorkspaceIdentity();
  return <WhatsAppWorkspace key={`${owner}:${tenant ?? "current"}`} initialConversationId={initialConversationId} tenant={tenant} />;
}
