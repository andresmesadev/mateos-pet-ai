"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useTenant, tenantQuery } from "@/lib/use-tenant";

import { PetMedicalSheet } from "@/components/dashboard/pet-medical-sheet";
import { NewPetSheet } from "@/components/dashboard/new-pet-sheet";
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pets;
    return pets.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.owner?.phone ?? "").toLowerCase().includes(q)
    );
  }, [pets, query]);

  const tenant = useTenant();

  const loadPets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(proxyUrl(`/api/dashboard/pets${tenantQuery(tenant)}`), {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudieron cargar las mascotas");
      }

      const payload = await response.json() as { data: DashboardPet[]; total: number };
      const nextPets = Array.isArray(payload) ? payload : (payload.data ?? []);
      setPets(nextPets);
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
  }, [tenant]);

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
  }, [initialPetId, openedFromQuery, tenant, loadPets]);

  const handleSelectPet = (pet: DashboardPet) => {
    setSelectedPet(pet);
    setSheetOpen(true);
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
            {!loading && !error && pets.length > 0 && (
              <Badge variant="outline" className="font-normal">
                {query ? `${filtered.length} de ${pets.length}` : pets.length}
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
                  className="pl-9"
                />
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
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Ninguna mascota coincide con “{query}”.
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
                {filtered.map((pet) => (
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
                    <TableCell>{formatPhone(pet.owner.phone)}</TableCell>
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
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectPet(pet)}
                      >
                        Ver expediente
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      <NewPetSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => { void loadPets(); }}
      />
    </>
  );
}
