"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTenant, tenantQuery } from "@/lib/use-tenant";

import { ClientSheet } from "@/components/dashboard/client-sheet";
import { NewOwnerPetsSheet } from "@/components/dashboard/new-owner-pets-sheet";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { proxyUrl } from "@/lib/api";
import {
  type DashboardClient,
  formatPhone,
  formatRelativeTime,
} from "@/lib/clients";

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ClientsTable() {
  const tenant = useTenant();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState(() => searchParams.get("search") ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q)
    );
  }, [clients, query]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!cancelled) setLoading(true);
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/clients${tenantQuery(tenant)}`), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No se pudieron cargar los clientes");
        }

        const payload = await response.json() as { data: DashboardClient[]; total: number };
        const data = Array.isArray(payload) ? payload : (payload.data ?? []);

        if (!cancelled) {
          setClients(data);
          setError(null);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error al cargar clientes"
          );
          setClients([]);
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
  }, [tenant, version]);

  const handleOpenClient = (client: DashboardClient) => {
    setSelectedId(client.id);
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
        <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Propietarios</CardTitle>
            {!loading && !error && clients.length > 0 && (
              <Badge variant="outline" className="font-normal">
                {query ? `${filtered.length} de ${clients.length}` : clients.length}
              </Badge>
            )}
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {!loading && !error && clients.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre o teléfono…"
                  className="pl-9"
                />
              </div>
            )}
            <Button size="sm" className="shrink-0 gap-1" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo propietario
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error}
            </div>
          ) : clients.length === 0 ? (
            <EmptyState
              icon="👋"
              title="No hay propietarios registrados"
              description="Los propietarios aparecerán automáticamente aquí cuando alguien escriba por WhatsApp y el agente registre su conversación."
              hint="El agente WhatsApp está activo"
            />
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Ningún propietario coincide con “{query}”.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Propietario</TableHead>
                  <TableHead>Mascotas</TableHead>
                  <TableHead>Citas</TableHead>
                  <TableHead>Última actividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() => handleOpenClient(client)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-400">
                          {(client.name?.trim()?.[0] ?? "#").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">
                            {client.name ?? formatPhone(client.phone)}
                          </div>
                          {client.name ? (
                            <div className="text-sm text-muted-foreground">
                              {formatPhone(client.phone)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{client.petsCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{client.appointmentsCount}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(client.lastActivityAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ClientSheet
        clientId={selectedId}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
      />

      <NewOwnerPetsSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => setVersion((v) => v + 1)}
      />
    </>
  );
}
