"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Pencil, Plus, PawPrint, Search, Trash2, X } from "lucide-react";
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
import { ContactPagination } from "@/components/dashboard/contact-pagination";
import { useDashboardAccess } from "./dashboard-access-provider";
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
  initialNew = false,
}: {
  initialPetId?: string | null;
  initialNew?: boolean;
}) {
  const [pets, setPets] = useState<DashboardPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPet, setSelectedPet] = useState<DashboardPet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [initialEdit, setInitialEdit] = useState(false);
  const [openedFromQuery, setOpenedFromQuery] = useState(false);
  const [newOpen, setNewOpen] = useState(initialNew);
  const [query, setQuery] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [deleting, setDeleting] = useState<string | null>(null);
  const PAGE_SIZE = 50;


  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const access = useDashboardAccess();
  const tenant = useTenant();
  const requestId = useRef(0);

  const loadPets = useCallback(async (overridePage?: number) => {
    const currentPage = overridePage ?? page;
    const thisRequest = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const sep = tenantQuery(tenant) ? `${tenantQuery(tenant)}&` : "?";
      const searchParam = debouncedQuery.trim() ? `&search=${encodeURIComponent(debouncedQuery.trim())}` : "";
      const url = proxyUrl(`/api/dashboard/pets${sep}page=${currentPage}&limit=${PAGE_SIZE}${searchParam}`);
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(response.status === 503
          ? "El servidor de datos no está disponible. Intenta de nuevo."
          : "No se pudieron cargar las mascotas");
      }

      const payload = await response.json() as { data: DashboardPet[]; total: number; totalPages: number };
      const nextPets = Array.isArray(payload) ? payload : (payload.data ?? []);
      if (thisRequest !== requestId.current) return [];
      setPets(nextPets);
      setTotal(payload.total ?? nextPets.length);
      const pages = Math.max(1, Math.ceil((payload.total ?? nextPets.length) / PAGE_SIZE));
      if (currentPage > pages) setPage(pages);
      return nextPets;
    } catch (err) {
      if (thisRequest !== requestId.current) return [];
      setError(
        err instanceof Error ? err.message : "Error al cargar mascotas"
      );
      setPets([]);
      return [];
    } finally {
      if (thisRequest === requestId.current) setLoading(false);
    }
  }, [tenant, page, debouncedQuery]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const nextPets = await loadPets();
      if (!cancelled && initialPetId && !openedFromQuery) {
        let pet = nextPets.find((item) => item.id === initialPetId);
        if (!pet) {
          try {
            const response = await fetch(proxyUrl(`/api/dashboard/pets/${encodeURIComponent(initialPetId)}${tenantQuery(tenant)}`), { cache: "no-store" });
            if (response.ok) pet = await response.json() as DashboardPet;
          } catch { /* El listado conserva su propio mensaje de error. */ }
        }
        if (cancelled) return;
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

  const handleSelectPet = (pet: DashboardPet, edit = false) => {
    setInitialEdit(edit);
    setSelectedPet(pet);
    setSheetOpen(true);
  };

  const handleDeletePet = async (e: React.MouseEvent, pet: DashboardPet) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar a "${pet.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(pet.id);
    try {
      const sep = tenantQuery(tenant) ? `${tenantQuery(tenant)}&` : "?";
      const response = await fetch(proxyUrl(`/api/dashboard/pets/${pet.id}${sep.replace("&", "")}`), { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo eliminar la mascota.");
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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {(
              <div className="w-full sm:w-80"><label htmlFor="pets-search" className="mb-1 block text-sm font-medium">Buscar mascota o propietario</label><div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pets-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar mascota por nombre, propietario, raza o teléfono"
                  placeholder="Mascota, propietario, raza o teléfono"
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
              Nueva mascota
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              <p>{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => { void loadPets(); }}>
                Reintentar
              </Button>
            </div>
          ) : pets.length === 0 && debouncedQuery.trim() ? (
            <p role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">Ninguna mascota coincide con “{debouncedQuery}”. Prueba otro nombre, propietario o teléfono.</p>
          ) : pets.length === 0 ? (
            <EmptyState icon={<PawPrint className="h-7 w-7" />} title="No hay mascotas registradas" description="Agrega una mascota y vincúlala a su propietario desde Nueva mascota." />
          ) : (
            <>
            <div className="space-y-3 md:hidden">{pets.map((pet) => <article key={pet.id} className="rounded-xl border p-4"><h3 className="font-semibold">{getPetEmoji(pet.type)} {pet.name}</h3><p className="text-sm text-muted-foreground">{formatPetType(pet.type)} · {pet.breed || "Raza sin registrar"}</p><p className="mt-2 text-sm">Propietario: {pet.owner.name || "Sin nombre"}</p><p className="text-sm text-muted-foreground">{formatPhone(pet.owner.phone)}</p><p className="mt-2 text-xs text-muted-foreground">{access?.capabilities.clinical ? `${pet._count.medicalRecords ?? 0} registros · ` : ""}{pet._count.appointments} citas</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => handleSelectPet(pet)}>Ver ficha</Button><Button variant="outline" onClick={() => handleSelectPet(pet, true)}>Editar</Button>{access?.capabilities.administration && <Button variant="ghost" aria-label={`Eliminar mascota ${pet.name}`} disabled={deleting === pet.id} onClick={(e) => handleDeletePet(e, pet)}><Trash2 className="h-4 w-4" /></Button>}</div></article>)}</div>
            <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mascota</TableHead>
                  <TableHead>Especie</TableHead>
                  <TableHead>Dueño</TableHead>
                  {access?.capabilities.clinical && <TableHead>Registros</TableHead>}
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
                        <div><p>{pet.name}</p><p className="text-xs font-normal text-muted-foreground">{pet.breed || "Raza sin registrar"}</p></div>
                      </div>
                    </TableCell>
                    <TableCell>{formatPetType(pet.type)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{pet.owner.name ?? "Sin nombre"}</div>
                      <div className="text-xs text-muted-foreground">{formatPhone(pet.owner.phone)}</div>
                    </TableCell>
                    {access?.capabilities.clinical && <TableCell>
                      <Badge variant="outline">
                        {pet._count.medicalRecords}
                      </Badge>
                    </TableCell>}
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
                          className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <Eye className="h-4 w-4" /> Ver
                        </button>
                        <button
                          title="Editar mascota"
                          onClick={() => handleSelectPet(pet, true)}
                          className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-4 w-4" /> Editar
                        </button>
                        {access?.capabilities.administration && <button
                          title="Eliminar mascota"
                          disabled={deleting === pet.id}
                          onClick={(e) => handleDeletePet(e, pet)}
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

          {/* Paginación */}
          {!loading && !error && <ContactPagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />}

        </CardContent>
      </Card>

      <PetMedicalSheet
        pet={selectedPet}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onRecordAdded={handleRecordAdded}
        initialEdit={initialEdit}
      />

      <AddPetToOwnerFlow
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => { void loadPets(); }}
      />
    </>
  );
}
