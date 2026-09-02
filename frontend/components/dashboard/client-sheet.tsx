"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PetMedicalSheet } from "@/components/dashboard/pet-medical-sheet";
import { NewPetSheet } from "@/components/dashboard/new-pet-sheet";
import { proxyUrl } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import {
  formatColombiaDateTime,
  formatService,
  formatStatus,
  statusBadgeClass,
} from "@/lib/appointments";
import {
  type ClientDetail,
  type ClientPet,
  formatClientRegisteredAt,
  formatPhone,
} from "@/lib/clients";
import { type DashboardPet, formatPetType, getPetEmoji } from "@/lib/pets";

function clientPetToDashboardPet(pet: ClientPet, owner: { phone: string; name: string | null }): DashboardPet {
  return {
    id: pet.id,
    name: pet.name,
    type: pet.type,
    breed: pet.breed,
    gender: pet.gender,
    birthDate: pet.birthDate,
    weight: pet.weight,
    sterilized: pet.sterilized,
    notes: pet.notes,
    owner,
    _count: pet._count,
  };
}

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
  const { toast } = useToast();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", phoneAlt: "", email: "", address: "", notes: "" });
  const [expedientePet, setExpedientePet] = useState<DashboardPet | null>(null);
  const [addingPet, setAddingPet] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/clients/${clientId}`), {
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
        <DialogHeader className="border-b px-4 py-4">
          <DialogTitle>Cargando…</DialogTitle>
        </DialogHeader>
        <ClientSheetSkeleton />
      </>
    );
  }

  const handleEdit = () => {
    setEditForm({
      name: client?.name ?? "",
      phone: client?.phone ?? "",
      phoneAlt: client?.phoneAlt ?? "",
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
      const res = await fetch(proxyUrl(`/api/dashboard/clients/${client.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const updated = await res.json();
      setClient((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
      toast("Cambios guardados.", "success");
    } catch (err) {
      console.error(err);
      toast("No se guardó. Intenta de nuevo.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (error || !client) {
    return (
      <>
        <DialogHeader className="border-b px-4 py-4">
          <DialogTitle>Cliente</DialogTitle>
        </DialogHeader>
        <div className="px-4 py-8 text-sm text-destructive">
          {error ?? "Cliente no encontrado"}
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader className="border-b px-4 py-4">
        <DialogTitle className="flex flex-col items-start gap-1">
          <span>{formatPhone(client.phone)}</span>
          {client.name ? (
            <span className="text-base font-normal text-muted-foreground">
              {client.name}
            </span>
          ) : null}
        </DialogTitle>
        <DialogDescription>
          Cliente desde {formatClientRegisteredAt(client.createdAt)}
        </DialogDescription>
      </DialogHeader>

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
                placeholder="Telefono principal"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <Input
                placeholder="Telefono alternativo (opcional)"
                type="tel"
                value={editForm.phoneAlt}
                onChange={(e) => setEditForm((f) => ({ ...f, phoneAlt: e.target.value }))}
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
              {client.phoneAlt && <p><span className="text-muted-foreground">Tel. alternativo: </span>{formatPhone(client.phoneAlt)}</p>}
              {client.email && <p><span className="text-muted-foreground">Email: </span>{client.email}</p>}
              {client.address && <p><span className="text-muted-foreground">Dirección: </span>{client.address}</p>}
              {client.notes && <p><span className="text-muted-foreground">Notas: </span>{client.notes}</p>}
              {!client.phoneAlt && !client.email && !client.address && !client.notes && (
                <p className="text-muted-foreground">Sin datos adicionales.</p>
              )}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mascotas</h3>
            <button
              type="button"
              onClick={() => setAddingPet(true)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Agregar mascota
            </button>
          </div>
          {client.pets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin mascotas registradas.</p>
          ) : (
            <ul className="space-y-2">
              {client.pets.map((pet) => (
                <li
                  key={pet.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-card px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-base ring-1 ring-amber-500/20">
                      {getPetEmoji(pet.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{pet.name}</p>
                      <p className="text-xs text-muted-foreground">{formatPetType(pet.type)}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setExpedientePet(clientPetToDashboardPet(pet, { phone: client.phone, name: client.name }))}
                  >
                    Ver expediente
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
            <Link href={`/dashboard/conversations?conversation=${client.latestConversationId}`}>
              Ver conversación
            </Link>
          </Button>
        ) : (
          <Button asChild className="w-full" variant="outline">
            <Link href="/dashboard/conversations">Ir a conversaciones</Link>
          </Button>
        )}
      </div>

      {/* Expediente de mascota inline */}
      <PetMedicalSheet
        pet={expedientePet}
        open={expedientePet !== null}
        onOpenChange={(v) => { if (!v) setExpedientePet(null); }}
      />

      {/* Agregar mascota con teléfono pre-llenado */}
      <NewPetSheet
        open={addingPet}
        onOpenChange={setAddingPet}
        defaultOwnerPhone={client.phone}
        onCreated={() => {
          setAddingPet(false);
          setClient((prev) => prev ? { ...prev } : prev);
          toast("Mascota agregada.", "success");
        }}
      />
    </>
  );
}

export function ClientSheet({
  clientId,
  open,
  onOpenChange,
}: ClientSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-full max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {open && clientId ? (
          <ClientSheetContent key={clientId} clientId={clientId} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
