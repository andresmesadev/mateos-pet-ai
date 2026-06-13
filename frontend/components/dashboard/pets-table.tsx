"use client";

import { useCallback, useEffect, useState } from "react";

import { PetMedicalSheet } from "@/components/dashboard/pet-medical-sheet";
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
import { apiUrl } from "@/lib/api";
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

export function PetsTable() {
  const [pets, setPets] = useState<DashboardPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPet, setSelectedPet] = useState<DashboardPet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadPets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/dashboard/pets"), {
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(apiUrl("/api/dashboard/pets"), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No se pudieron cargar las mascotas");
        }

        const data: DashboardPet[] = await response.json();

        if (!cancelled) {
          setPets(Array.isArray(data) ? data : []);
          setError(null);
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
  }, []);

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
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="font-medium">No hay mascotas registradas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Las mascotas aparecerán aquí cuando los clientes conversen por
                WhatsApp.
              </p>
            </div>
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
