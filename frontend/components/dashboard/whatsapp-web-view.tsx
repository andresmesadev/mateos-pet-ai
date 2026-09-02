"use client";

import { useEffect, useRef, useState } from "react";
import {
  MoreVertical,
  Search,
  Send,
  Smile,
  Paperclip,
  CheckCheck,
  MessageCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { proxyUrl } from "@/lib/api";
import {
  type ConversationDetail,
  type ConversationMessage,
  type ConversationsResponse,
  type DashboardConversation,
  formatColombiaTime,
  formatConversationStep,
  formatPhone,
  formatRelativeTime,
} from "@/lib/conversations";
import { cn } from "@/lib/utils";

// Piel visual estilo WhatsApp Web (modo oscuro) sobre datos y API propios —
// no hay integración ni embed con web.whatsapp.com, es una vista propia.
const WA_SIDEBAR_BG = "#111b21";
const WA_HEADER = "#202c33";
const WA_CHAT_BG = "#0b141a";
const WA_OUT_BUBBLE = "#005c4b";
const WA_IN_BUBBLE = "#202c33";
const WA_TEXT = "#e9edef";
const WA_MUTED = "#8696a0";
const WA_ACCENT = "#00a884";
const WA_SELECTED = "#2a3942";

const WA_PATTERN_BG = {
  backgroundColor: WA_CHAT_BG,
  backgroundImage:
    "radial-gradient(circle at 8px 8px, rgba(255,255,255,0.035) 1.4px, transparent 0), radial-gradient(circle at 24px 22px, rgba(255,255,255,0.025) 1px, transparent 0)",
  backgroundSize: "36px 36px",
};

function initialsFor(name: string | null, phone: string | null): string {
  if (name) return name.trim().slice(0, 2).toUpperCase();
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.slice(-2) || "🐾";
}

// ── Panel izquierdo: lista de chats ────────────────────────────────────────

function ChatListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatListItem({
  conversation,
  active,
  onClick,
}: {
  conversation: DashboardConversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors"
      style={{
        backgroundColor: active ? WA_SELECTED : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "#182229";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        style={{ backgroundColor: "#334147", color: WA_MUTED }}
      >
        {initialsFor(null, conversation.phone)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[15px] font-medium" style={{ color: WA_TEXT }}>
            {formatPhone(conversation.phone)}
          </span>
          <span className="shrink-0 text-[11px]" style={{ color: WA_MUTED }}>
            {formatRelativeTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px]" style={{ color: WA_MUTED }}>
            {conversation.lastMessage ?? "Sin mensajes"}
          </span>
          {conversation.requires_human_attention ? (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: "#dc2626", color: "#fff" }}
            >
              Urgente
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// ── Panel derecho: burbujas de mensaje ─────────────────────────────────────

function MessagesSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className={cn("h-14 w-3/5", i % 2 === 1 && "ml-auto")} />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isOutgoing = message.role === "assistant";

  return (
    <div className={cn("flex w-full px-1", isOutgoing ? "justify-end" : "justify-start")}>
      <div
        className="relative max-w-[65%] rounded-lg px-2.5 py-1.5 text-[14.2px] leading-[19px] shadow-sm"
        style={{
          backgroundColor: isOutgoing ? WA_OUT_BUBBLE : WA_IN_BUBBLE,
          color: WA_TEXT,
          borderTopRightRadius: isOutgoing ? 0 : undefined,
          borderTopLeftRadius: isOutgoing ? undefined : 0,
        }}
      >
        <span
          aria-hidden
          className="absolute top-0 h-0 w-0"
          style={
            isOutgoing
              ? { right: -8, borderTop: `8px solid ${WA_OUT_BUBBLE}`, borderRight: "8px solid transparent" }
              : { left: -8, borderTop: `8px solid ${WA_IN_BUBBLE}`, borderLeft: "8px solid transparent" }
          }
        />
        <p className="whitespace-pre-wrap break-words pr-12">{message.content}</p>
        <span
          className="pointer-events-none absolute bottom-1 right-2 flex items-center gap-1 text-[11px]"
          style={{ color: isOutgoing ? "rgba(233,237,239,0.65)" : WA_MUTED }}
        >
          {formatColombiaTime(message.createdAt).split(", ").pop()}
          {isOutgoing ? <CheckCheck className="h-3.5 w-3.5" style={{ color: "#53bdeb" }} /> : null}
        </span>
      </div>
    </div>
  );
}

function ChatDetailPane({ conversationId }: { conversationId: string }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(background: boolean) {
      if (!background) {
        setLoading(true);
        setDetail(null);
      }
      try {
        const res = await fetch(
          proxyUrl(`/api/dashboard/conversations/${conversationId}/messages`),
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("No se pudo cargar la conversación");
        const data: ConversationDetail = await res.json();
        if (cancelled) return;
        setDetail((prev) => {
          if (background && prev && prev.messages.length === data.messages.length) {
            return prev;
          }
          return data;
        });
        setError(null);
      } catch (err) {
        if (!cancelled && !background) {
          setError(err instanceof Error ? err.message : "Error al cargar mensajes");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load(false);
    const intervalId = window.setInterval(() => void load(true), 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, detail?.messages.length]);

  async function handleSend() {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/conversations/${conversationId}/send`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "No se pudo enviar");
      }
      const { message: saved } = (await res.json()) as { message: ConversationMessage };
      setDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, saved] } : prev));
      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al enviar", "error");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const conversation = detail?.conversation;
  const displayName = conversation?.name ?? formatPhone(conversation?.phone ?? null);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ backgroundColor: WA_CHAT_BG }}>
      <div
        className="flex shrink-0 items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: WA_HEADER }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: "#334147", color: WA_MUTED }}
          >
            {initialsFor(conversation?.name ?? null, conversation?.phone ?? null)}
          </div>
          <div>
            <p className="text-[15px] font-medium leading-tight" style={{ color: WA_TEXT }}>
              {displayName}
            </p>
            <p className="text-xs leading-tight" style={{ color: WA_MUTED }}>
              {conversation?.requires_human_attention
                ? "requiere atención humana"
                : conversation
                  ? formatConversationStep(conversation.step)
                  : "cargando…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4" style={{ color: WA_MUTED }}>
          <Search className="h-[18px] w-[18px]" />
          <MoreVertical className="h-[18px] w-[18px]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-6 py-4 sm:px-14" style={WA_PATTERN_BG}>
        {loading ? (
          <MessagesSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : detail?.messages.length ? (
          <>
            {detail.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            <div ref={bottomRef} aria-hidden className="h-px shrink-0" />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm" style={{ color: WA_MUTED }}>
            No hay mensajes en esta conversación.
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 px-4 py-2.5" style={{ backgroundColor: WA_HEADER }}>
        <Smile className="h-[22px] w-[22px] shrink-0" style={{ color: WA_MUTED }} />
        <Paperclip className="h-[20px] w-[20px] shrink-0" style={{ color: WA_MUTED }} />
        <div className="flex flex-1 items-end rounded-lg px-3 py-2" style={{ backgroundColor: "#2a3942" }}>
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje"
            disabled={sending || loading}
            className="flex-1 resize-none bg-transparent text-[15px] leading-relaxed focus:outline-none disabled:opacity-50"
            style={{ maxHeight: "120px", overflowY: "auto", color: WA_TEXT }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSend}
          disabled={!text.trim() || sending || loading}
          className="h-9 w-9 shrink-0 rounded-full p-0 hover:brightness-110"
          style={{ backgroundColor: WA_ACCENT, color: "#0b141a" }}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EmptyDetailPane() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center"
      style={{ backgroundColor: WA_SIDEBAR_BG }}
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ backgroundColor: WA_HEADER, color: WA_ACCENT }}
      >
        <MessageCircle className="h-9 w-9" />
      </div>
      <p className="text-lg font-light" style={{ color: WA_TEXT }}>
        Selecciona un chat para ver los mensajes
      </p>
      <p className="max-w-xs text-sm" style={{ color: WA_MUTED }}>
        El historial completo de cada conversación con tus clientes por WhatsApp aparece aquí.
      </p>
    </div>
  );
}

// ── Vista completa ──────────────────────────────────────────────────────────

export function WhatsAppWebView({ initialConversationId = null }: { initialConversationId?: string | null }) {
  const [conversations, setConversations] = useState<DashboardConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId);

  useEffect(() => {
    let cancelled = false;

    async function load(background: boolean) {
      if (!background) setLoading(true);
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/conversations?page=1&limit=50`), {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("No se pudieron cargar las conversaciones");
        const payload: ConversationsResponse = await response.json();
        if (!cancelled) {
          setConversations(Array.isArray(payload.data) ? payload.data : []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && !background) {
          setError(err instanceof Error ? err.message : "Error al cargar conversaciones");
          setConversations([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load(false);
    const intervalId = window.setInterval(() => void load(true), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div
      className="flex overflow-hidden rounded-xl border border-white/[0.08]"
      style={{ height: "calc(100dvh - 190px)", minHeight: 480, maxHeight: "calc(100dvh - 190px)" }}
    >
      {/* Sidebar de chats */}
      <div className="flex w-[380px] shrink-0 flex-col" style={{ backgroundColor: WA_SIDEBAR_BG }}>
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          style={{ backgroundColor: WA_HEADER }}
        >
          <span className="text-[16px] font-medium" style={{ color: WA_TEXT }}>
            WhatsApp
          </span>
        </div>
        <div className="shrink-0 px-3 py-2" style={{ backgroundColor: WA_SIDEBAR_BG }}>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ backgroundColor: WA_HEADER }}
          >
            <Search className="h-4 w-4" style={{ color: WA_MUTED }} />
            <input
              disabled
              placeholder="Buscar cliente o teléfono"
              className="w-full bg-transparent text-sm placeholder:text-current focus:outline-none"
              style={{ color: WA_MUTED }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <ChatListSkeleton />
          ) : error ? (
            <div className="px-4 py-8 text-center text-sm text-destructive">{error}</div>
          ) : conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <MessageCircle className="h-8 w-8" style={{ color: WA_MUTED }} />
              <p className="text-sm" style={{ color: WA_MUTED }}>
                Cada chat de WhatsApp con un cliente aparecerá aquí.
              </p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <ChatListItem
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === selectedId}
                onClick={() => setSelectedId(conversation.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Panel de chat */}
      <div className="flex-1">
        {selectedId ? <ChatDetailPane key={selectedId} conversationId={selectedId} /> : <EmptyDetailPane />}
      </div>
    </div>
  );
}
