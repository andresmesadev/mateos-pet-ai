"use client";

import { useEffect, useState } from "react";

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
import { apiUrl } from "@/lib/api";
import {
  type Escalation,
  formatPhone,
  formatRelativeTime,
} from "@/lib/escalations";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 30_000;

function PanelSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function EscalationsPanel() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchEscalations = async () => {
      try {
        const response = await fetch(apiUrl("/api/dashboard/escalations"), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No se pudieron cargar las escalaciones");
        }

        const data: Escalation[] = await response.json();

        if (!cancelled) {
          setEscalations(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error al cargar escalaciones"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchEscalations();

    const interval = setInterval(() => {
      void fetchEscalations();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleResolve = async (id: string) => {
    setResolvingId(id);

    try {
      const response = await fetch(
        apiUrl(`/api/dashboard/escalations/${id}/resolve`),
        { method: "PATCH" }
      );

      if (!response.ok) {
        throw new Error("No se pudo marcar como atendido");
      }

      setEscalations((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Error al resolver escalación"
      );
    } finally {
      setResolvingId(null);
    }
  };

  const hasPending = escalations.length > 0;

  return (
    <Card
      className={cn(
        "mt-8 transition-colors",
        hasPending && "border-2 border-red-500 shadow-red-500/10 shadow-sm"
      )}
    >
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            Atención humana
            {hasPending ? (
              <Badge className="border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                Urgente
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Conversaciones que requieren intervención de Lina · actualización
            cada 30 s
          </CardDescription>
        </div>

        {hasPending ? (
          <Badge variant="outline" className="w-fit">
            {escalations.length} pendiente{escalations.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent>
        {loading ? (
          <PanelSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : !hasPending ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center">
            <p className="text-lg font-medium">Todo tranquilo 🐾</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No hay conversaciones esperando atención humana.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {escalations.map((escalation) => (
              <li
                key={escalation.id}
                className="rounded-lg border border-red-200/80 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/20"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                        Urgente
                      </Badge>
                      <span className="font-medium">
                        {formatPhone(escalation.phone)}
                      </span>
                      {escalation.petName ? (
                        <span className="text-sm text-muted-foreground">
                          · Mascota: {escalation.petName}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm leading-relaxed">
                      {escalation.lastMessage ?? "Sin mensajes registrados"}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(escalation.lastMessageAt)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={resolvingId === escalation.id}
                    onClick={() => handleResolve(escalation.id)}
                    className="shrink-0"
                  >
                    {resolvingId === escalation.id
                      ? "Guardando…"
                      : "Marcar atendido"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
