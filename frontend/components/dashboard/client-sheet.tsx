"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Plus, UserRound, MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NewAppointmentDialog } from "@/components/dashboard/new-appointment-dialog";
import { ProtectedDialog, SavedChangesStatus, useDialogEditGuard } from "@/components/dashboard/protected-dialog";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPetAge, groupClientAppointments } from "@/lib/contact-profile-utils";
import { ownerAgendaHref } from "@/lib/contact-navigation";
import { PetMedicalSheet } from "@/components/dashboard/pet-medical-sheet";
import { NewPetSheet } from "@/components/dashboard/new-pet-sheet";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
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

function clientPetToDashboardPet(pet: ClientPet, owner: { id: string; phone: string; name: string | null }): DashboardPet {
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
    operationalAlerts: pet.operationalAlerts,
    owner,
    _count: pet._count,
  };
}

type ClientSheetProps = {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEdit?: boolean;
  onUpdated?: () => void;
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

function ClientSheetContent({ clientId, initialEdit = false, onUpdated, onNavigate }: { clientId: string; initialEdit?: boolean; onUpdated?: () => void; onNavigate: () => void }) {
  const router = useRouter();
  const access = useDashboardAccess();
  const tenant = useTenant();
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(initialEdit);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", phoneAlt: "", email: "", address: "", notes: "" });
  const [expedientePet, setExpedientePet] = useState<DashboardPet | null>(null);
  const [addingPet, setAddingPet] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [newAppointment, setNewAppointment] = useState(false);
  const [appointmentPetId, setAppointmentPetId] = useState<string | undefined>();
  const dirty = Boolean(editing && client && (Object.keys(editForm) as (keyof typeof editForm)[]).some((field) => editForm[field] !== (client[field] ?? "")));
  const discard = useDialogEditGuard(dirty, saving);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(proxyUrl(`/api/dashboard/clients/${clientId}${tenantQuery(tenant)}`), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No se pudo cargar el cliente");
        }

        const data: ClientDetail = await response.json();

        if (!cancelled) {
          setClient(data);
          setEditForm({ name: data.name ?? "", phone: data.phone, phoneAlt: data.phoneAlt ?? "", email: data.email ?? "", address: data.address ?? "", notes: data.notes ?? "" });
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
  }, [clientId, tenant, refresh]);

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
      const res = await fetch(proxyUrl(`/api/dashboard/clients/${client.id}${tenantQuery(tenant)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(access?.capabilities.administration ? editForm : { ...editForm, notes: undefined }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      const updated = await res.json();
      setClient((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
      setSavedAt(new Date());
      onUpdated?.();
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

  const appointments = groupClientAppointments(client.appointments, now);
  const agendaHref = ownerAgendaHref(client.id, tenant, (appointments.upcoming[0] ?? appointments.pending[0] ?? appointments.previous[0])?.date);
  const conversationHref = `/dashboard/conversations?conversation=${encodeURIComponent(client.latestConversationId ?? "")}${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`;

  return (
    <>
      <DialogHeader className="border-b px-6 py-5">
        <div className="flex items-start gap-3 pr-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><UserRound className="size-6" /></span>
        <div className="min-w-0">
        <DialogTitle className="flex flex-col items-start gap-1">
          <span>{client.name || "Cliente sin nombre"}</span>
          {client.name ? (
            <span className="text-base font-normal text-muted-foreground">
              {formatPhone(client.phone)}
            </span>
          ) : null}
        </DialogTitle>
        <DialogDescription>
          Cliente desde {formatClientRegisteredAt(client.createdAt)}
        </DialogDescription>
        </div></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <SavedChangesStatus dirty={dirty} saving={saving} savedAt={savedAt} />
          {access?.capabilities.schedule && <Button disabled={dirty || saving || client.pets.length === 0} onClick={() => { setAppointmentPetId(client.pets.length === 1 ? client.pets[0].id : undefined); setNewAppointment(true); }} className="gap-2"><CalendarPlus className="h-4 w-4" />Nueva cita</Button>}
        </div>
        {dirty && <p className="text-xs text-muted-foreground">Guarda o cancela los cambios antes de agendar.</p>}
      </DialogHeader>

      <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
        {/* Ficha del cliente */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Contacto y notas del propietario</h3>
            {!editing && (
              <Button size="sm" variant="outline" onClick={handleEdit}>Editar</Button>
            )}
          </div>
          {editing ? (
            <fieldset disabled={saving} className="space-y-3">
              <label className="block text-sm font-medium">Nombre
              <Input
                placeholder="Nombre"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
              </label>
              <label className="block text-sm font-medium">Teléfono principal
              <Input
                placeholder="Telefono principal"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
              </label>
              <label className="block text-sm font-medium">Teléfono alternativo (opcional)
              <Input
                placeholder="Telefono alternativo (opcional)"
                type="tel"
                value={editForm.phoneAlt}
                onChange={(e) => setEditForm((f) => ({ ...f, phoneAlt: e.target.value }))}
              />
              </label>
              <label className="block text-sm font-medium">Correo electrónico (opcional)
              <Input
                placeholder="Email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
              </label>
              <label className="block text-sm font-medium">Dirección (opcional)
              <Input
                placeholder="Dirección"
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
              />
              </label>
              <label hidden={!access?.capabilities.administration} className="block text-sm font-medium">Notas del propietario (opcional)
              <Textarea
                rows={4}
                placeholder="Notas"
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
              </label>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => discard(() => setEditing(false))} disabled={saving}>
                  Cancelar
                </Button>
              </div>
            </fieldset>
          ) : (
            <div className="rounded-xl border p-4 text-sm">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">Teléfono principal</dt><dd className="mt-1 break-words font-medium">{formatPhone(client.phone)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Teléfono alternativo</dt><dd className="mt-1 break-words">{client.phoneAlt ? formatPhone(client.phoneAlt) : "Sin registrar"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Correo electrónico</dt><dd className="mt-1 break-words">{client.email || "Sin registrar"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Dirección</dt><dd className="mt-1 break-words">{client.address || "Sin registrar"}</dd></div>
              </dl>
              <div hidden={!access?.capabilities.administration} className="mt-4 border-t pt-4"><h4 className="font-semibold">Notas del propietario</h4><p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{client.notes || "Todavía no hay notas del propietario."}</p></div>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Mascotas ({client.pets.length})</h3>
            <button
              type="button"
              disabled={dirty || saving}
              onClick={() => setAddingPet(true)}
              className="flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline"
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
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-card px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-base ring-1 ring-amber-500/20">
                      {getPetEmoji(pet.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{pet.name}</p>
                      <p className="text-sm text-muted-foreground">{formatPetType(pet.type)}{pet.breed ? ` · ${pet.breed}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{formatPetAge(pet.birthDate)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2"><Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 text-sm"
                    disabled={dirty || saving}
                    onClick={() => setExpedientePet(clientPetToDashboardPet(pet, { id: client.id, phone: client.phone, name: client.name }))}
                  >
                    Ver expediente
                  </Button>
                  <Button size="sm" variant="outline" disabled={dirty || saving || !access?.capabilities.schedule} onClick={() => { setAppointmentPetId(pet.id); setNewAppointment(true); }}>Nueva cita</Button></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Citas del propietario" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold">Citas del propietario</h3><Link href={agendaHref} onClick={(event) => { event.preventDefault(); discard(() => { onNavigate(); router.push(agendaHref); }); }} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">Abrir agenda del propietario</Link></div>
          <p className="text-xs text-muted-foreground">Esta ficha muestra las cinco citas más recientes por fecha. Consulta la agenda para ver todas.</p>
          {[{ title: "Próximas citas", rows: appointments.upcoming, empty: "No hay citas próximas en esta selección." }, { title: "Atenciones pendientes de cierre", rows: appointments.pending, empty: "" }, { title: "Visitas y citas anteriores", rows: appointments.previous, empty: "No hay citas cerradas en esta selección." }].map((group) => group.rows.length || group.empty ? <div key={group.title}>
            <h4 className="mb-2 text-sm font-semibold">{group.title}</h4>
            {group.rows.length ? <ul className="divide-y rounded-xl border">{group.rows.map((appointment) => <li key={appointment.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{formatColombiaDateTime(appointment.date)}</p><Badge variant="outline" className={statusBadgeClass(appointment.status)}>{formatStatus(appointment.status)}</Badge></div>
              <p className="mt-1 text-sm text-muted-foreground">{formatService(appointment.serviceType)} · {appointment.petName}</p>
            </li>)}</ul> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{group.empty}</p>}
          </div> : null)}
        </section>

        <section aria-label="Conversaciones del propietario" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-teal-50/30 p-4">
          <div><h3 className="flex items-center gap-2 text-base font-semibold"><MessageCircle className="size-4" />Conversaciones</h3><p className="mt-1 text-sm text-muted-foreground">{client.conversationsCount ? `${client.conversationsCount} conversaciones registradas.` : "Todavía no hay conversaciones de este propietario."}</p></div>
          {client.latestConversationId && <Button asChild variant="outline"><Link href={conversationHref} onClick={(event) => { event.preventDefault(); discard(() => { onNavigate(); router.push(conversationHref); }); }}>Ver última conversación</Link></Button>}
        </section>
      </div>

      {/* Expediente de mascota inline */}
      {newAppointment && access?.capabilities.schedule && <NewAppointmentDialog initialDate={new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })} initialClientId={client.id} initialPetId={appointmentPetId} onClose={() => setNewAppointment(false)} onCreated={() => { setNewAppointment(false); setRefresh((value) => value + 1); onUpdated?.(); }} />}
      <PetMedicalSheet
        pet={expedientePet}
        open={expedientePet !== null}
        onOpenChange={(v) => { if (!v) setExpedientePet(null); }}
        onRecordAdded={() => { setRefresh((value) => value + 1); onUpdated?.(); }}
      />

      {/* Agregar mascota con teléfono pre-llenado */}
      <NewPetSheet
        open={addingPet}
        onOpenChange={setAddingPet}
        defaultOwnerPhone={client.phone}
        onCreated={() => {
          setAddingPet(false);
          setRefresh((value) => value + 1);
          onUpdated?.();
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
  initialEdit = false,
  onUpdated,
}: ClientSheetProps) {
  return (
    <ProtectedDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-full max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {open && clientId ? (
          <ClientSheetContent key={`${clientId}-${initialEdit}`} clientId={clientId} initialEdit={initialEdit} onUpdated={onUpdated} onNavigate={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </ProtectedDialog>
  );
}
