"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { apiUrl } from "@/lib/api";
import {
  formatColombiaDateTime,
  formatService,
  formatStatus,
  statusBadgeClass,
} from "@/lib/appointments";
import {
  type ClientDetail,
  formatClientRegisteredAt,
  formatPhone,
} from "@/lib/clients";
import { formatPetType, getPetEmoji } from "@/lib/pets";

type ClientSheetProps = {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ClientSheetSkeleton() {
  return (
    <div className="space-y-6 px-4 pb-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function ClientSheetContent({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", address: "", notes: "" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(apiUrl(`/api/dashboard/clients/${clientId}`), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No se pudo cargar el cliente");
        }

        const data: ClientDetail = await response.json();

        if (!cancelled) {
          setClient(data);
          setError(null);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error al cargar cliente"
          );
          setClient(null);
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
  }, [clientId]);

  if (loading) {
    return (
      <>
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>Cargando…</SheetTitle>
        </SheetHeader>
        <ClientSheetSkeleton />
      </>
    );
  }

  const handleEdit = () => {
    setEditForm({
      name: client?.name ?? "",
      email: client?.email ?? "",
      address: client?.address ?? "",
      notes: client?.notes ?? "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/dashboard/clients/${client.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const updated = await res.json();
      setClient((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (error || !client) {
    return (
      <>
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>Cliente</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-8 text-sm text-destructive">
          {error ?? "Cliente no encontrado"}
        </div>
      </>
    );
  }

  return (
    <>
      <SheetHeader className="border-b px-4 py-4">
        <SheetTitle className="flex flex-col items-start gap-1">
          <span>{formatPhone(client.phone)}</span>
          {client.name ? (
            <span className="text-base font-normal text-muted-foreground">
              {client.name}
            </span>
          ) : null}
        </SheetTitle>
        <SheetDescription>
          Cliente desde {formatClientRegisteredAt(client.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6">
        {/* Ficha del cliente */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Datos del cliente</h3>
            {!editing && (
              <Button size="sm" variant="outline" onClick={handleEdit}>Editar</Button>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <Input
                placeholder="Nombre"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                placeholder="Email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                placeholder="Dirección"
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
              />
              <Input
                placeholder="Notas"
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-1">
              {client.email && <p><span className="text-muted-foreground">Email: </span>{client.email}</p>}
              {client.address && <p><span className="text-muted-foreground">Dirección: </span>{client.address}</p>}
              {client.notes && <p><span className="text-muted-foreground">Notas: </span>{client.notes}</p>}
              {!client.email && !client.address && !client.notes && (
                <p className="text-muted-foreground">Sin datos adicionales.</p>
              )}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Mascotas</h3>
          {client.pets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin mascotas registradas.
            </p>
          ) : (
            <ul className="space-y-2">
              {client.pets.map((pet) => (
                <li
                  key={pet.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span>{getPetEmoji(pet.type)}</span>
                    <div>
                      <p className="font-medium">{pet.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPetType(pet.type)}
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/pets?pet=${pet.id}`}>
                      Ver expediente
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Últimas citas
          </h3>
          {client.appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin citas registradas.</p>
          ) : (
            <ul className="space-y-2">
              {client.appointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {formatColombiaDateTime(appointment.date)}
                    </p>
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(appointment.status)}
                    >
                      {formatStatus(appointment.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {formatService(appointment.serviceType)} ·{" "}
                    {appointment.petName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border bg-muted/30 px-3 py-3 text-sm">
          <p>
            <span className="text-muted-foreground">Conversaciones:</span>{" "}
            <span className="font-medium">{client.conversationsCount}</span>
          </p>
        </section>

        {client.latestConversationId ? (
          <Button asChild className="w-full">
            <Link
              href={`/dashboard/conversations?conversation=${client.latestConversationId}`}
            >
              Ver conversación
            </Link>
          </Button>
        ) : (
          <Button asChild className="w-full" variant="outline">
            <Link href="/dashboard/conversations">Ir a conversaciones</Link>
          </Button>
        )}
      </div>
    </>
  );
}

export function ClientSheet({
  clientId,
  open,
  onOpenChange,
}: ClientSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {open && clientId ? (
          <ClientSheetContent key={clientId} clientId={clientId} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
