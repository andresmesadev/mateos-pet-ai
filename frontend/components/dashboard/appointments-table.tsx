"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  type Appointment,
  type DateFilter,
  filterAppointments,
  formatClient,
  formatColombiaDateTime,
  formatAppointmentPet,
  formatService,
  formatStatus,
  statusBadgeClass,
} from "@/lib/appointments";

const FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "all", label: "Todas" },
];

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function AppointmentsTable() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<DateFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/dashboard/appointments"), {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudieron cargar las citas");
      }

      const data: Appointment[] = await response.json();
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Error al cargar las citas"
      );
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const filteredAppointments = useMemo(
    () => filterAppointments(appointments, filter),
    [appointments, filter]
  );

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Citas recientes</CardTitle>
          <CardDescription>
            Datos en tiempo real desde PostgreSQL (hora Colombia)
          </CardDescription>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? "default" : "outline"}
              onClick={() => setFilter(option.value)}
              disabled={loading}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center">
            <p className="font-medium">No hay citas para mostrar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter === "all"
                ? "Aún no se han registrado citas en el sistema."
                : "No hay citas que coincidan con el filtro seleccionado."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Mascota</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell className="font-medium">
                    {formatColombiaDateTime(appointment.date)}
                  </TableCell>
                  <TableCell>{formatClient(appointment.userId)}</TableCell>
                  <TableCell>
                    {formatAppointmentPet(appointment)}
                  </TableCell>
                  <TableCell>{formatService(appointment.serviceType)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(appointment.status)}
                    >
                      {formatStatus(appointment.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
