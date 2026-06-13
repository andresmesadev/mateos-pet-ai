"use client";

import { useEffect, useState } from "react";

import { ClientSheet } from "@/components/dashboard/client-sheet";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import { apiUrl } from "@/lib/api";
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
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(apiUrl("/api/dashboard/clients"), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No se pudieron cargar los clientes");
        }

        const data: DashboardClient[] = await response.json();

        if (!cancelled) {
          setClients(Array.isArray(data) ? data : []);
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
  }, []);

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
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>
            Usuarios registrados por WhatsApp y su actividad reciente
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error}
            </div>
          ) : clients.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="font-medium">No hay clientes registrados</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Aparecerán aquí cuando alguien escriba por WhatsApp.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Mascotas</TableHead>
                  <TableHead>Citas</TableHead>
                  <TableHead>Última actividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => handleOpenClient(client)}
                  >
                    <TableCell>
                      <div className="font-medium">
                        {formatPhone(client.phone)}
                      </div>
                      {client.name ? (
                        <div className="text-sm text-muted-foreground">
                          {client.name}
                        </div>
                      ) : null}
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
          )}
        </CardContent>
      </Card>

      <ClientSheet
        clientId={selectedId}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
      />
    </>
  );
}
