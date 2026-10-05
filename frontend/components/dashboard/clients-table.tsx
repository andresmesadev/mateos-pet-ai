"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
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
import { ContactPagination } from "@/components/dashboard/contact-pagination";
import { useDashboardAccess } from "./dashboard-access-provider";
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
  const access = useDashboardAccess();
  const tenant = useTenant();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<DashboardClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("client"));
  const [sheetOpen, setSheetOpen] = useState(() => Boolean(searchParams.get("client")));
  const [initialEdit, setInitialEdit] = useState(false);
  const [newOpen, setNewOpen] = useState(() => searchParams.get("new") === "cliente");
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState(() => searchParams.get("search") ?? "");
  const [deleting, setDeleting] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const PAGE_SIZE = 50;


  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) setLoading(true);
      try {
        const sep = tenantQuery(tenant) ? `${tenantQuery(tenant)}&` : "?";
        const searchParam = debouncedQuery.trim()
          ? `&search=${encodeURIComponent(debouncedQuery.trim())}`
          : "";
        const url = proxyUrl(
          `/api/dashboard/clients${sep}page=${page}&limit=${PAGE_SIZE}${searchParam}`
        );
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(response.status === 503
            ? "El servidor de datos no está disponible. Intenta de nuevo."
            : "No se pudieron cargar los clientes");
        }
        const payload = await response.json() as {
          data: DashboardClient[];
          total: number;
          totalPages: number;
        };
        const data = Array.isArray(payload) ? payload : (payload.data ?? []);
        if (!cancelled) {
          setClients(data);
          setTotal(payload.total ?? data.length);
          const pages = Math.max(1, Math.ceil((payload.total ?? data.length) / PAGE_SIZE));
          if (page > pages) setPage(pages);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar clientes");
          setClients([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant, version, page, debouncedQuery]);

  const handleOpenClient = (client: DashboardClient, edit = false) => {
    setInitialEdit(edit);
    setSelectedId(client.id);
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) setSelectedId(null);
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`Eliminar al cliente "${name}"? Esta accion no se puede deshacer.`)) return;
    setDeleting(id);
    try {
      const base = proxyUrl(`/api/dashboard/clients/${id}`);
      const tq = tenantQuery(tenant);
      const url = tq ? `${base}?${tq.replace("?", "")}` : base;
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo eliminar el cliente.");
      setVersion((v) => v + 1);
    } catch {
      alert("No se pudo eliminar el cliente.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Clientes</CardTitle>
            {!loading && !error && (
              <Badge variant="outline" className="font-normal">
                {debouncedQuery.trim()
                  ? `${total.toLocaleString()} encontrados`
                  : `${total.toLocaleString()} clientes`}
              </Badge>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {(
              <div className="w-full sm:w-80"><label htmlFor="clients-search" className="mb-1 block text-sm font-medium">Buscar cliente</label><div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="clients-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar cliente por nombre o teléfono"
                  placeholder="Nombre o teléfono del cliente"
                  className="pl-9 pr-8"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div></div>
            )}
            <Button size="sm" className="min-h-11 shrink-0 gap-1 sm:self-end" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setVersion((v) => v + 1)}>
                Reintentar
              </Button>
            </div>
          ) : clients.length === 0 && debouncedQuery.trim() ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {["Ningún cliente coincide con “", debouncedQuery, "”. Prueba otro nombre o teléfono."].join("")}
            </div>
          ) : clients.length === 0 ? (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="No hay clientes registrados"
              description="Registra al propietario y sus mascotas desde Nuevo cliente."
            />
          ) : (
            <>
            <div className="space-y-3 md:hidden">{clients.map((client) => <article key={client.id} className="rounded-xl border p-4"><h3 className="font-semibold">{client.name || "Cliente sin nombre"}</h3><p className="text-sm text-muted-foreground">{formatPhone(client.phone)}</p><p className="mt-2 text-sm">{client.petsCount} mascotas · {client.appointmentsCount} citas</p><p className="text-xs text-muted-foreground">Última actividad: {formatRelativeTime(client.lastActivityAt)}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => handleOpenClient(client)}>Ver cliente</Button><Button variant="outline" onClick={() => handleOpenClient(client, true)}>Editar</Button>{access?.capabilities.administration && <Button variant="ghost" aria-label={`Eliminar cliente ${client.name ?? client.phone}`} disabled={deleting === client.id} onClick={(e) => handleDelete(e, client.id, client.name ?? client.phone)}><Trash2 className="h-4 w-4" /></Button>}</div></article>)}</div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-black/[0.08]">
                    <TableHead className="font-semibold text-foreground/70 uppercase text-[11px] tracking-wider">Cliente</TableHead>
                    <TableHead className="font-semibold text-foreground/70 uppercase text-[11px] tracking-wider">Mascotas</TableHead>
                    <TableHead className="font-semibold text-foreground/70 uppercase text-[11px] tracking-wider">Citas</TableHead>
                    <TableHead className="font-semibold text-foreground/70 uppercase text-[11px] tracking-wider">Ultima actividad</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer transition-colors hover:bg-primary/[0.06] border-b border-black/[0.05]"
                      onClick={() => handleOpenClient(client)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-700">
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
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            title="Ver cliente"
                            onClick={() => handleOpenClient(client)}
                            className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            <Eye className="h-4 w-4" /> Ver
                          </button>
                          <button
                            title="Editar cliente"
                            onClick={() => handleOpenClient(client, true)}
                            className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </button>
                          {access?.capabilities.administration && <button
                            title="Eliminar cliente"
                            disabled={deleting === client.id}
                            onClick={(e) => handleDelete(e, client.id, client.name ?? client.phone)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}

          {!loading && !error && <ContactPagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />}

        </CardContent>
      </Card>

      <ClientSheet
        clientId={selectedId}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        initialEdit={initialEdit}
        onUpdated={() => setVersion((v) => v + 1)}
      />

      <NewOwnerPetsSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => setVersion((v) => v + 1)}
      />
    </>
  );
}
