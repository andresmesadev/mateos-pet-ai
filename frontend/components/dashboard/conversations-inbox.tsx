"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

import { ConversationSheet } from "@/components/dashboard/conversation-sheet";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { proxyUrl } from "@/lib/api";
import {
  type ConversationsResponse,
  type DashboardConversation,
  formatConversationStep,
  formatPhone,
  formatRelativeTime,
} from "@/lib/conversations";
import { cn } from "@/lib/utils";

function InboxSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 px-4 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ConversationsInbox({
  initialConversationId = null,
}: {
  initialConversationId?: string | null;
}) {
  const [conversations, setConversations] = useState<DashboardConversation[]>(
    []
  );
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversationId
  );
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialConversationId));

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          proxyUrl(`/api/dashboard/conversations?page=${page}&limit=20`),
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("No se pudieron cargar las conversaciones");
        }

        const payload: ConversationsResponse = await response.json();

        if (!cancelled) {
          setConversations(Array.isArray(payload.data) ? payload.data : []);
          setTotalPages(payload.pagination?.totalPages ?? 1);
          setError(null);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Error al cargar conversaciones"
          );
          setConversations([]);
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
  }, [page]);

  const handleOpenConversation = (conversation: DashboardConversation) => {
    setSelectedId(conversation.id);
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);

    if (!open) {
      setSelectedId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle className="text-base">Bandeja de conversaciones</CardTitle>
            <CardDescription>
              Historial completo de chats por WhatsApp (hora Colombia)
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <InboxSkeleton />
          ) : error ? (
            <div className="px-4 py-8 text-center text-sm text-destructive">
              {error}
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState
              icon="💬"
              title="No hay conversaciones"
              description="Cada chat de WhatsApp con un cliente aparecerá aquí en tiempo real, con su historial y estado."
              hint="El agente WhatsApp está activo"
            />
          ) : (
            <div className="divide-y">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => handleOpenConversation(conversation)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-accent/50",
                    conversation.requires_human_attention &&
                      "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <MessageCircle className="h-5 w-5" />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {formatPhone(conversation.phone)}
                        </span>
                        {conversation.requires_human_attention ? (
                          <Badge className="border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                            Urgente
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(conversation.lastMessageAt)}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {conversation.lastMessage ?? "Sin mensajes"}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {formatConversationStep(conversation.step)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && !error && totalPages > 1 ? (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => Math.max(1, current - 1));
                }}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage((current) => current + 1);
                }}
              >
                Siguiente
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ConversationSheet
        conversationId={selectedId}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
      />
    </>
  );
}
