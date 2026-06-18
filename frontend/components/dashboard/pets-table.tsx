"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant, tenantQuery } from "@/lib/use-tenant";

import { PetMedicalSheet } from "@/components/dashboard/pet-medical-sheet";
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

      const data: DashboardPet[] = await response.json();
      const nextPets = Array.isArray(data) ? data : [];
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
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/pets${tenantQuery(tenant)}`), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No se pudieron cargar las mascotas");
        }

        const data: DashboardPet[] = await response.json();

        if (!cancelled) {
          const nextPets = Array.isArray(data) ? data : [];
          setPets(nextPets);
          setError(null);

          if (initialPetId && !openedFromQuery) {
            const pet = nextPets.find((item) => item.id === initialPetId);

            if (pet) {
              setSelectedPet(pet);
              setSheetOpen(true);
              setOpenedFromQuery(true);
            }
          }
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error al cargar mascotas"
          );
          setPets([]);
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
  }, [initialPetId, openedFromQuery, tenant]);

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
        <CardHeader>
          <CardTitle>Expedientes médicos</CardTitle>
          <CardDescription>
            Mascotas registradas y su historial clínico
          </CardDescription>
        </CardHeader>

        <CardContent>
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
          ) : (
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
                  <TableRow key={pet.id}>
                    <TableCell className="font-medium">
                      <span className="mr-2">{getPetEmoji(pet.type)}</span>
                      {pet.name}
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
          )}
        </CardContent>
      </Card>

      <PetMedicalSheet
        pet={selectedPet}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onRecordAdded={handleRecordAdded}
      />
    </>
  );
}
