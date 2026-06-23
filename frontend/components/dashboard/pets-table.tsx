"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useTenant, tenantQuery } from "@/lib/use-tenant";

import { PetMedicalSheet } from "@/components/dashboard/pet-medical-sheet";
import { AddPetToOwnerFlow } from "@/components/dashboard/add-pet-to-owner-flow";
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
  type DashboardPet,
  formatPetType,
  formatPhone,
  getPetEmoji,
} from "@/lib/pets";

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function PetsTable({
  initialPetId = null,
}: {
  initialPetId?: string | null;
}) {
  const [pets, setPets] = useState<DashboardPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPet, setSelectedPet] = useState<DashboardPet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openedFromQuery, setOpenedFromQuery] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [query, setQuery] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [deleting, setDeleting] = useState<string | null>(null);
  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const tenant = useTenant();

  const loadPets = useCallback(async (overridePage?: number) => {
    const currentPage = overridePage ?? page;
    setLoading(true);
    setError(null);

    try {
      const sep = tenantQuery(tenant) ? `${tenantQuery(tenant)}&` : "?";
      const searchParam = debouncedQuery.trim() ? `&search=${encodeURIComponent(debouncedQuery.trim())}` : "";
      const url = proxyUrl(`/api/dashboard/pets${sep}page=${currentPage}&limit=${PAGE_SIZE}${searchParam}`);
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("No se pudieron cargar las mascotas");
      }

      const payload = await response.json() as { data: DashboardPet[]; total: number; totalPages: number };
      const nextPets = Array.isArray(payload) ? payload : (payload.data ?? []);
      setPets(nextPets);
      setTotal(payload.total ?? nextPets.length);
      return nextPets;
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Error al cargar mascotas"
      );
      setPets([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [tenant, page, debouncedQuery]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const nextPets = await loadPets();
      if (!cancelled && initialPetId && !openedFromQuery) {
        const pet = nextPets.find((item) => item.id === initialPetId);
        if (pet) {
          setSelectedPet(pet);
          setSheetOpen(true);
          setOpenedFromQuery(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialPetId, openedFromQuery, tenant, loadPets, page]);

  useEffect(() => {
    const handler = () => { void loadPets(); };
    window.addEventListener("pets:refresh", handler);
    return () => window.removeEventListener("pets:refresh", handler);
  }, [loadPets]);

  const handleSelectPet = (pet: DashboardPet) => {
    setSelectedPet(pet);
    setSheetOpen(true);
  };

  const handleDeletePet = async (e: React.MouseEvent, pet: DashboardPet) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar a "${pet.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(pet.id);
    try {
      const sep = tenantQuery(tenant) ? `${tenantQuery(tenant)}&` : "?";
      await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}${sep.replace("&", "")}`), { method: "DELETE" });
      void loadPets();
    } catch {
      alert("No se pudo eliminar la mascota. Inténtalo de nuevo.");
    } finally {
      setDeleting(null);
    }
  };

  const handleRecordAdded = async () => {
    const nextPets = await loadPets();
    const petId = selectedPet?.id;

    if (petId) {
      const updated = nextPets.find((pet) => pet.id === petId);
      if (updated) {
        setSelectedPet(updated);
      }
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Mascotas</CardTitle>
            {!loading && !error && (
              <Badge variant="outline" className="font-normal">
                {debouncedQuery.trim()
                  ? `${total.toLocaleString()} encontradas`
                  : `${total.toLocaleString()} mascotas`}
              </Badge>
            )}
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {!loading && !error && pets.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por mascota o teléfono…"
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
              </div>
            )}
            <Button size="sm" className="shrink-0 gap-1" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva mascota
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
          ) : pets.length === 0 ? (
            <EmptyState
              icon="🐾"
              title="No hay mascotas registradas"
              description="Las mascotas se registran solas cuando los clientes conversan por WhatsApp y mencionan a sus compañeros peludos."
              hint="El agente WhatsApp está activo"
            />
          ) : pets.length === 0 && debouncedQuery.trim() ? (
            <div className={['px-4 py-8 text-center text-sm text-muted-foreground'].join('')}>
              {['Ninguna mascota coincide con “', debouncedQuery, '”.'].join('')}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mascota</TableHead>
                  <TableHead>Especie</TableHead>
                  <TableHead>Dueño</TableHead>
                  <TableHead>Registros</TableHead>
                  <TableHead>Citas</TableHead>
                  <TableHead className="text-right">Expediente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pets.map((pet) => (
                  <TableRow
                    key={pet.id}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() => handleSelectPet(pet)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-base">
                          {getPetEmoji(pet.type)}
                        </div>
                        {pet.name}
                      </div>
                    </TableCell>
                    <TableCell>{formatPetType(pet.type)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{pet.owner.name ?? "Sin nombre"}</div>
                      <div className="text-xs text-muted-foreground">{formatPhone(pet.owner.phone)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {pet._count.medicalRecords}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {pet._count.appointments}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          title="Ver expediente"
                          onClick={() => handleSelectPet(pet)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          title="Editar mascota"
                          onClick={() => handleSelectPet(pet)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title="Eliminar mascota"
                          disabled={deleting === pet.id}
                          onClick={(e) => handleDeletePet(e, pet)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}

          {/* Paginación */}
          {!loading && !error && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
              <p className="text-xs text-muted-foreground">
                Página {page} de {totalPages} · mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  size="sm" variant="outline" className="h-7 px-2 text-xs"
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                >«</Button>
                <Button
                  size="sm" variant="outline" className="h-7 px-2 text-xs"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >‹ Anterior</Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                  .reduce<(number | "...")[]>((acc, n, i, arr) => {
                    if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push("...");
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === "..." ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={n}
                        size="sm"
                        variant={page === n ? "default" : "outline"}
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setPage(n as number)}
                      >{n}</Button>
                    )
                  )}
                <Button
                  size="sm" variant="outline" className="h-7 px-2 text-xs"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >Siguiente ›</Button>
                <Button
                  size="sm" variant="outline" className="h-7 px-2 text-xs"
                  disabled={page === totalPages}
                  onClick={() => setPage(totalPages)}
                >»</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PetMedicalSheet
        pet={selectedPet}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onRecordAdded={handleRecordAdded}
      />

      <AddPetToOwnerFlow
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => { void loadPets(); }}
      />
    </>
  );
}
