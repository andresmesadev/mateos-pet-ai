"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { proxyUrl } from "@/lib/api";
import { getPetEmoji } from "@/lib/pets";

const DEFAULT_MESSAGE =
  "Hola {nombre} 👋 Te escribimos desde Mateos Pet. Hace tiempo no vemos a tu mascota por acá. ¿Todo bien? Escríbenos si quieres agendar una cita o tienes alguna duda 🐾";

type InactiveClient = {
  id: string;
  phone: string;
  name: string | null;
  pets: { name: string; type: string }[];
  lastAppointmentDate: string | null;
};

type Props = {
  clients: InactiveClient[];
};

function daysSince(iso: string | null): string {
  if (!iso) return "sin fecha";
  const diff = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86_400_000
  );
  if (diff < 30) return `hace ${diff} días`;
  if (diff < 60) return "hace ~1 mes";
  const months = Math.floor(diff / 30);
  return `hace ~${months} meses`;
}

export function ReactivationCampaign({ clients }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allSelected =
    clients.length > 0 && selected.size === clients.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(clients.map((c) => c.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSend() {
    if (selected.size === 0) return;
    setSending(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        proxyUrl("/api/dashboard/campaigns/reactivation"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientIds: Array.from(selected),
            message,
          }),
        }
      );

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Error al enviar campaña");
      }

      const data = await res.json();
      setResult(data);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSending(false);
    }
  }

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-lg font-medium">¡Todos activos! 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No hay clientes sin cita en los últimos 60 días.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mensaje */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mensaje de reactivación</CardTitle>
          <CardDescription>
            Usa <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{nombre}"}</code> para personalizar con el nombre del cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            disabled={sending}
          />
        </CardContent>
      </Card>

      {/* Resultado */}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-900 dark:bg-green-950/20">
          <p className="font-medium text-green-800 dark:text-green-300">
            Campaña enviada — {result.sent} exitosos · {result.failed} fallidos de {result.total}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Lista */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Clientes inactivos
                <Badge variant="secondary" className="ml-2">
                  {clients.length}
                </Badge>
              </CardTitle>
              <CardDescription>Sin cita en más de 60 días</CardDescription>
            </div>

            <Button
              size="sm"
              onClick={handleSend}
              disabled={selected.size === 0 || sending || !message.trim()}
            >
              {sending
                ? "Enviando…"
                : `Enviar a ${selected.size > 0 ? selected.size : "seleccionados"}`}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Seleccionar todos */}
          <label className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 hover:bg-muted/40">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm font-medium">
              {allSelected ? "Deseleccionar todos" : `Seleccionar todos (${clients.length})`}
            </span>
          </label>

          <ul className="divide-y">
            {clients.map((client) => (
              <li key={client.id}>
                <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={selected.has(client.id)}
                    onChange={() => toggle(client.id)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                    disabled={sending}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {client.name ?? client.phone}
                      </span>
                      {client.name && (
                        <span className="text-xs text-muted-foreground">
                          {client.phone}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {client.pets.map((pet, i) => (
                        <span key={i} className="text-sm text-muted-foreground">
                          {getPetEmoji(pet.type)} {pet.name}
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        · Última cita: {daysSince(client.lastAppointmentDate)}
                      </span>
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
