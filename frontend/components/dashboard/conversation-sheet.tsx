"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { apiUrl } from "@/lib/api";
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
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-14 w-3/4", index % 2 === 1 && "ml-auto")}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={cn(
        "flex w-full",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
          isAssistant
            ? "bg-blue-600 text-white"
            : "bg-muted text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={cn(
            "mt-1.5 text-[11px]",
            isAssistant ? "text-blue-100" : "text-muted-foreground"
          )}
        >
          {formatColombiaTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function ConversationSheetContent({
  conversationId,
}: {
  conversationId: string;
}) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          apiUrl(`/api/dashboard/conversations/${conversationId}/messages`),
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("No se pudo cargar la conversación");
        }

        const data: ConversationDetail = await response.json();

        if (!cancelled) {
          setDetail(data);
          setError(null);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error al cargar mensajes"
          );
          setDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!loading && detail?.messages.length) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading, detail?.messages.length]);

  const conversation = detail?.conversation;

  return (
    <>
      <SheetHeader className="border-b px-4 py-4">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          <span>{formatPhone(conversation?.phone ?? null)}</span>
          {conversation?.requires_human_attention ? (
            <Badge className="border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              Atención humana
            </Badge>
          ) : null}
        </SheetTitle>
        <SheetDescription>
          {conversation
            ? formatConversationStep(conversation.step)
            : "Historial de mensajes"}
        </SheetDescription>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <MessagesSkeleton />
        ) : error ? (
          <div className="p-4 text-sm text-destructive">{error}</div>
        ) : detail?.messages.length ? (
          <div className="flex flex-col gap-3 p-4">
            {detail.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} aria-hidden className="h-px shrink-0" />
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No hay mensajes en esta conversación.
          </div>
        )}
      </ScrollArea>
    </>
  );
}

export function ConversationSheet({
  conversationId,
  open,
  onOpenChange,
}: ConversationSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        {open && conversationId ? (
          <ConversationSheetContent
            key={conversationId}
            conversationId={conversationId}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
