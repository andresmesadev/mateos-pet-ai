"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { proxyUrl } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import {
  type ConversationDetail,
  type ConversationMessage,
  formatColombiaTime,
  formatConversationStep,
  formatPhone,
} from "@/lib/conversations";
import { cn } from "@/lib/utils";

type ConversationSheetProps = {
  conversationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function MessagesSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className={cn("h-14 w-3/4", i % 2 === 1 && "ml-auto")} />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("flex w-full", isAssistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isAssistant
            ? "bg-primary/15 text-foreground ring-1 ring-primary/20"
            : "bg-accent/60 text-foreground ring-1 ring-white/[0.06]"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {formatColombiaTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function ConversationContent({ conversationId }: { conversationId: string }) {
  const { toast } = useToast();
  const [detail, setDetail]   = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [text, setText]       = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          proxyUrl(`/api/dashboard/conversations/${conversationId}/messages`),
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("No se pudo cargar la conversación");
        const data: ConversationDetail = await res.json();
        if (!cancelled) { setDetail(data); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar mensajes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, detail?.messages.length]);

  async function handleSend() {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        proxyUrl(`/api/dashboard/conversations/${conversationId}/send`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg }),
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "No se pudo enviar");
      }
      const { message: saved } = await res.json() as { message: ConversationMessage };
      setDetail((prev) =>
        prev ? { ...prev, messages: [...prev.messages, saved] } : prev
      );
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/25 text-lg">
            💬
          </div>
          <div>
            <DialogTitle className="text-base font-semibold tracking-tight">
              {formatPhone(conversation?.phone ?? null)}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {conversation ? formatConversationStep(conversation.step) : "Historial de mensajes"}
            </DialogDescription>
          </div>
        </div>
        {conversation?.requires_human_attention && (
          <Badge className="border-red-900 bg-red-950 text-red-300">
            Atención humana
          </Badge>
        )}
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
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
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            No hay mensajes en esta conversación.
          </div>
        )}
      </div>

      {/* Input envío */}
      <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">
        <div className="flex items-end gap-2 rounded-xl border border-white/[0.08] bg-accent/30 px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje… (Enter para enviar)"
            disabled={sending || loading}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
            style={{ maxHeight: "120px", overflowY: "auto" }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={!text.trim() || sending || loading}
            className="h-8 w-8 shrink-0 p-0"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground/50">
          Shift+Enter para nueva línea · El mensaje se envía por WhatsApp
        </p>
      </div>
    </div>
  );
}

export function ConversationSheet({ conversationId, open, onOpenChange }: ConversationSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose
        className="flex max-h-[88vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        {open && conversationId ? (
          <ConversationContent key={conversationId} conversationId={conversationId} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
