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

const PAGE_SIZE = 50;

type InactiveClient = {
  id: string;
  phone: string;
  name: string | null;
  pets: { name: string; type: string }[];
  lastVisitDate: string | null;
};

type Props = {
  clients: InactiveClient[];
};

function isNoPhone(phone: string): boolean {
  return !phone || phone.toUpperCase().startsWith("NOPHONE");
}

function formatPhone(phone: string): string {
  if (isNoPhone(phone)) return "Sin teléfono";
  return phone;
}

function timeSince(iso: string | null): string {
  if (!iso) return "sin fecha";
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays < 1) return "hoy";
  if (diffDays < 30) return `${diffDays} día${diffDays === 1 ? "" : "s"}`;

  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = diffDays % 30;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} año${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} mes${months === 1 ? "" : "es"}`);
  if (days > 0 && years === 0) parts.push(`${days} día${days === 1 ? "" : "s"}`);

  return `hace ${parts.join(", ")}`;
}

export function ReactivationCampaign({ clients }: Props) {
  const clientsWithPhone = clients.filter((c) => !isNoPhone(c.phone));
  const clientsNoPhone = clients.length - clientsWithPhone.length;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; noPhone: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(clients.length / PAGE_SIZE);
  const paginated = clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allOnPageSelected = paginated.length > 0 && paginated.every((c) => selected.has(c.id));
  const allSelected = clients.length > 0 && selected.size === clients.length;

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginated.forEach((c) => next.delete(c.id));
      } else {
        paginated.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (selected.size === 0) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/campaigns/reactivation"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds: Array.from(selected), message }),
      });
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
            No hay clientes de peluquería sin visita en el último año.
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
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-900 dark:bg-green-950/20 space-y-0.5">
          <p className="font-medium text-green-800 dark:text-green-300">
            ✓ Campaña enviada — {result.sent} mensaje{result.sent === 1 ? "" : "s"} enviado{result.sent === 1 ? "" : "s"}
          </p>
          <p className="text-green-700 dark:text-green-400 text-xs">
            {result.failed > 0 && `${result.failed} fallidos · `}
            {result.noPhone > 0 && `${result.noPhone} sin teléfono (omitidos) · `}
            {result.total} seleccionados en total
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">
                Clientes de peluquería inactivos
                <Badge variant="secondary" className="ml-2">{clients.length}</Badge>
              </CardTitle>
              <CardDescription>
                Sin visita en más de 60 días · {clientsWithPhone.length} con teléfono
                {clientsNoPhone > 0 && `, ${clientsNoPhone} sin teléfono`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <span className="text-xs text-muted-foreground">{selected.size} seleccionado{selected.size === 1 ? "" : "s"}</span>
              )}
              <Button
                size="sm"
                onClick={handleSend}
                disabled={selected.size === 0 || sending || !message.trim()}
              >
                {sending ? "Enviando…" : `Enviar a seleccionados`}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Selección masiva */}
          <div className="flex items-center gap-3 border-b px-4 py-2.5 bg-muted/30 text-sm">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={togglePage}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-muted-foreground">
              {allOnPageSelected ? "Deseleccionar página" : `Seleccionar página (${paginated.length})`}
            </span>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={toggleAll}
              className="text-primary hover:underline text-xs"
            >
              {allSelected ? "Deseleccionar todos" : `Seleccionar todos (${clients.length})`}
            </button>
          </div>

          <ul className="divide-y divide-white/[0.05]">
            {paginated.map((client) => {
              const phone = formatPhone(client.phone);
              const hasPhone = !isNoPhone(client.phone);
              const isSelected = selected.has(client.id);
              const initials = (client.name?.trim()?.[0] ?? "#").toUpperCase();
              return (
                <li key={client.id}>
                  <label className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.05] ${isSelected ? "bg-orange-500/5" : ""}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(client.id)}
                      className="h-4 w-4 accent-primary shrink-0"
                      disabled={sending}
                    />
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ${isSelected ? "bg-orange-500/20 text-orange-300 ring-orange-500/30" : "bg-muted text-muted-foreground ring-white/[0.08]"}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {client.name ?? "Sin nombre"}
                        </span>
                        {hasPhone ? (
                          <span className="text-xs text-muted-foreground">{phone}</span>
                        ) : (
                          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-medium text-orange-400">Sin teléfono</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {client.pets.map((pet, i) => (
                          <span key={i} className="text-xs text-muted-foreground">
                            {getPetEmoji(pet.type)} {pet.name}
                          </span>
                        ))}
                        <span className="text-xs text-muted-foreground">
                          · {timeSince(client.lastVisitDate)}
                        </span>
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Página {page} de {totalPages} · {clients.length} clientes en total
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                >
                  «
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ‹
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <Button
                      key={p}
                      size="sm"
                      variant={p === page ? "default" : "outline"}
                      className="h-7 w-7 text-xs"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={page === totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  »
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
