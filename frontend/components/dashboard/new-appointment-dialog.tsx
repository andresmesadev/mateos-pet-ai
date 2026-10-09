"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarPlus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { proxyUrl } from "@/lib/api";
import { formatPetType } from "@/lib/pets";
import { useTenant, tenantQuery } from "@/lib/use-tenant";
import { useToast } from "@/components/ui/toast";
import { ProtectedDialog, useDialogEditGuard } from "@/components/dashboard/protected-dialog";
import { NewOwnerPetsSheet } from "@/components/dashboard/new-owner-pets-sheet";
import { NewPetSheet } from "@/components/dashboard/new-pet-sheet";
import { slotTimeLabel as hourLabel } from "@/lib/slot-time";
import { FormDialogContent, FormDialogHeader, FormDialogBody, FormDialogFooter, FormSection } from "./form-layout";
import { FieldError, FormSubmissionError, useFormFeedback } from "./form-feedback";
import { submissionErrorMessage } from "@/lib/form-feedback";

type Client = { id: string; name: string | null; phone: string };
type Pet = { id: string; name: string; type: string };
type Service = {
  id: string;
  name: string;
  category: string | null;
  active: boolean;
  requiresAppointment: boolean;
};

type NewAppointmentProps = {
  initialDate: string;
  onClose: () => void;
  onCreated: () => void;
  serviceCategory?: "grooming" | "veterinary";
  initialClientId?: string;
  initialPetId?: string;
};

function NewAppointmentContent({
  initialDate, onClose, onCreated, serviceCategory, initialClientId, initialPetId,
}: NewAppointmentProps) {
  const tenant = useTenant();
  const { toast } = useToast();
  const feedback = useFormFeedback();
  const [registration, setRegistration] = useState<"owner" | "pet" | null>(null);
  const [query, setQuery] = useState("");
  const [initialQuery, setInitialQuery] = useState("");
  const [matches, setMatches] = useState<Client[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState("");
  const access = useDashboardAccess();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [professionals, setProfessionals] = useState<{ id: string; name: string; role: string; active: boolean }[]>([]);
  const [staffError, setStaffError] = useState("");
  const [dateKey, setDateKey] = useState(initialDate);
  const [hour, setHour] = useState("");
  const [slotVersion, setSlotVersion] = useState(0);
  const [slotResult, setSlotResult] = useState<{ key: string; slots: number[]; error: string | null } | null>(null);
  const [loadingClient, setLoadingClient] = useState(Boolean(initialClientId || initialPetId));
  const [loadingServices, setLoadingServices] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slotKey = `${tenant ?? ""}:${serviceId}:${staffId}:${dateKey}:${slotVersion}`;
  const currentSlots = slotResult?.key === slotKey ? slotResult : null;
  const availableHours = currentSlots?.slots ?? [];
  const loadingSlots = Boolean(serviceId && dateKey && !currentSlots);
  const dirty = Boolean(serviceId || hour || dateKey !== initialDate ||
    (petId && petId !== initialPetId) || query !== initialQuery);
  const discard = useDialogEditGuard(dirty, saving);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(proxyUrl(`/api/dashboard/staff${tenantQuery(tenant)}`), { cache: "no-store", signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error("No se pudo cargar el equipo. Puedes reservar sin asignar y revisarlo después.");
      return res.json();
    }).then(rows => { if (!controller.signal.aborted) { setProfessionals(rows); setStaffError(""); } }).catch(cause => { if (!controller.signal.aborted) setStaffError(cause instanceof Error ? cause.message : "No se pudo cargar el equipo."); });
    return () => controller.abort();
  }, [tenant]);

  useEffect(() => {
    if (!initialClientId && !initialPetId) return;
    const controller = new AbortController();
    async function loadInitialSelection() {
      try {
        let ownerId = initialClientId;
        if (!ownerId && initialPetId) {
          const petResponse = await fetch(proxyUrl(`/api/dashboard/pets/${encodeURIComponent(initialPetId)}${tenantQuery(tenant)}`), { cache: "no-store", signal: controller.signal });
          if (!petResponse.ok) throw new Error("No se pudo cargar el propietario de la mascota.");
          const selectedPet = await petResponse.json() as { owner?: { id?: string } };
          ownerId = selectedPet.owner?.id;
        }
        if (!ownerId) throw new Error("No se pudo identificar al propietario. Búscalo por nombre o teléfono.");
        const response = await fetch(proxyUrl(`/api/dashboard/clients/${encodeURIComponent(ownerId)}${tenantQuery(tenant)}`), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("No se pudo cargar el cliente. Intenta de nuevo con el buscador.");
        const selected = await response.json() as Client & { pets?: Pet[] };
        const ownerPets = selected.pets ?? [];
        if (initialPetId && !ownerPets.some((pet) => pet.id === initialPetId)) throw new Error("La mascota ya no está vinculada a este propietario. Revisa su ficha antes de agendar.");
        if (!controller.signal.aborted) {
          setClient(selected);
          setQuery(selected.name || selected.phone);
          setInitialQuery(selected.name || selected.phone);
          setPets(ownerPets);
          setPetId(initialPetId ?? "");
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar la selección inicial.");
      } finally { if (!controller.signal.aborted) setLoadingClient(false); }
    }
    void loadInitialSelection();
    return () => controller.abort();
  }, [initialClientId, initialPetId, tenant]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(proxyUrl(`/api/dashboard/services${tenantQuery(tenant)}`), {
      cache: "no-store", signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudieron cargar los servicios");
        return res.json() as Promise<Service[]>;
      })
      .then((rows) => setServices(rows.filter((service) => access?.activeModules.includes(service.category ?? "") && service.active && service.requiresAppointment &&
        (serviceCategory ? service.category === serviceCategory : ["veterinary", "grooming"].includes(service.category ?? "")))))
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los servicios");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingServices(false); });
    return () => controller.abort();
  }, [tenant, serviceCategory, access]);

  useEffect(() => {
    if (client || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const suffix = tenantQuery(tenant).replace("?", "&");
      void fetch(proxyUrl(`/api/dashboard/clients?search=${encodeURIComponent(query.trim())}&limit=8${suffix}`), {
        cache: "no-store", signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("No se pudieron buscar clientes");
          return res.json() as Promise<Client[]>;
        })
        .then((rows) => setMatches(Array.isArray(rows) ? rows : []))
        .catch((cause) => {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudieron buscar clientes");
        });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [client, query, tenant]);

  useEffect(() => {
    if (!serviceId || !dateKey) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ serviceId, dateKey, ...(staffId ? { staffId } : {}) });
    const tenantSuffix = tenantQuery(tenant).replace("?", "&");
    void fetch(proxyUrl(`/api/dashboard/appointments/available-slots?${params}${tenantSuffix}`), {
      cache: "no-store", signal: controller.signal,
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({})) as { slots?: number[]; error?: string };
        if (!res.ok) throw new Error(payload.error ?? "No se pudieron consultar los horarios");
        return payload;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          const slots = Array.isArray(payload.slots) ? payload.slots : [];
          setSlotResult({ key: slotKey, slots, error: null });
          setHour(current => current && !slots.includes(Number(current)) ? "" : current);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setSlotResult({
          key: slotKey, slots: [], error: cause instanceof Error ? cause.message : "No se pudieron consultar los horarios",
        });
      });
    return () => controller.abort();
  }, [serviceId, staffId, dateKey, tenant, slotVersion, slotKey]);

  async function selectClient(selected: Client) {
    feedback.clearField("appointment-client");
    feedback.clearField("appointment-pet");
    setClient(selected);
    setQuery(selected.name ?? selected.phone);
    setMatches([]);
    setPetId("");
    setPets([]);
    setError(null);
    setLoadingClient(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/clients/${selected.id}${tenantQuery(tenant)}`), { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar las mascotas del cliente");
      const detail = await res.json() as { pets?: Pet[] };
      setPets(detail.pets ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las mascotas");
    } finally {
      setLoadingClient(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const customErrors: Record<string, string> = {};
    if (!client) customErrors["appointment-client"] = "Busca y selecciona un cliente de los resultados, o regístralo.";
    if (client && !petId) customErrors["appointment-pet"] = "Selecciona la mascota que asistirá.";
    if (serviceId && dateKey && !loadingSlots && !currentSlots?.error && availableHours.length > 0 && (!hour || !availableHours.includes(Number(hour)))) customErrors["appointment-hour"] = "Elige uno de los horarios disponibles.";
    if (!feedback.validate(event.currentTarget, { "appointment-service": "Selecciona el servicio.", "appointment-date": "Selecciona la fecha." }, customErrors)) return;
    if (!client || !petId || !serviceId || !dateKey || !hour || !availableHours.includes(Number(hour))) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/appointments${tenantQuery(tenant)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: client.id, petId, serviceId, dateKey, hour: Number(hour), ...(staffId ? { staffId } : {}) }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        if (res.status === 409) {
          setHour("");
          setSlotVersion((version) => version + 1);
        }
        throw new Error(payload.error ?? "No se pudo crear la cita");
      }
      toast("Cita creada en la agenda.", "success");
      onCreated();
    } catch (cause) {
      feedback.setSubmitError(submissionErrorMessage(cause, "No se pudo crear la cita."));
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
      <FormDialogContent>
        <FormDialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><CalendarPlus className="h-5 w-5" /></span>
            <div className="min-w-0">
              <DialogTitle>Nueva cita</DialogTitle>
              <DialogDescription>Busca al cliente o regístralo aquí con su mascota.</DialogDescription>
            </div>
          </div>
        </FormDialogHeader>
        <form onSubmit={submit} noValidate aria-busy={saving} className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <FormSubmissionError message={feedback.submitError} />
          <fieldset disabled={saving} className="min-w-0 space-y-6">
            <FormSection title="Cliente y mascota" description="Selecciona quién reserva y la mascota que recibirá la atención.">
            <div className="space-y-1.5">
              <label htmlFor="appointment-client" className="text-sm font-semibold">Cliente</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="appointment-client" value={query} autoComplete="off" disabled={loadingClient || saving} placeholder="Busca por nombre o teléfono" {...feedback.fieldProps("appointment-client")}
                  onChange={(event) => { feedback.clearField("appointment-client"); setQuery(event.target.value); setClient(null); setPetId(""); setPets([]); setMatches([]); }} className="pl-9" />
              </div>
              <FieldError id="appointment-client" message={feedback.errors["appointment-client"]} />
              {!client && matches.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border bg-background shadow-sm">
                  {matches.map((match) => (
                    <button key={match.id} type="button" onClick={() => void selectClient(match)}
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted">
                      <span className="font-semibold">{match.name ?? "Sin nombre"}</span>
                      <span className="text-xs text-muted-foreground">{match.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {access?.capabilities.contacts ? <Button type="button" size="sm" variant="outline" onClick={() => setRegistration("owner")}>Registrar cliente y mascota</Button> : <p className="text-xs text-muted-foreground">Solicita el registro al administrador si faltan el cliente o la mascota.</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="appointment-pet" className="text-sm font-semibold">Mascota</label>
              <select id="appointment-pet" className={fieldClass} value={petId} {...feedback.fieldProps("appointment-pet")} onChange={(event) => { feedback.clearField("appointment-pet"); setPetId(event.target.value); }} disabled={!client || loadingClient} required>
                <option value="">{loadingClient ? "Cargando mascotas…" : "Selecciona una mascota"}</option>
                {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} · {formatPetType(pet.type)}</option>)}
              </select>
              <FieldError id="appointment-pet" message={feedback.errors["appointment-pet"]} />
              {client && access?.capabilities.contacts && <Button type="button" size="sm" variant="outline" disabled={loadingClient} onClick={() => setRegistration("pet")}>Agregar mascota a este cliente</Button>}
              {client && !loadingClient && pets.length === 0 && <p className="text-xs text-amber-700">Este cliente todavía no tiene mascotas registradas.</p>}
            </div>
            </FormSection>
            <FormSection title="Servicio y profesional" description="El profesional es opcional; la disponibilidad depende del servicio elegido.">
            <div className="space-y-1.5">
              <label htmlFor="appointment-service" className="text-sm font-semibold">Servicio</label>
              <select id="appointment-service" className={fieldClass} value={serviceId} {...feedback.fieldProps("appointment-service")} onChange={(event) => { feedback.clearField("appointment-service"); feedback.clearField("appointment-hour"); setServiceId(event.target.value); setStaffId(""); setHour(""); }} disabled={loadingServices} required>
                <option value="">{loadingServices ? "Cargando servicios…" : "Selecciona un servicio"}</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
              <FieldError id="appointment-service" message={feedback.errors["appointment-service"]} />
              {!loadingServices && services.length === 0 && <p className="text-xs text-amber-700">No hay servicios con cita activos.</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="appointment-professional" className="text-sm font-semibold">Profesional responsable <span className="font-normal text-muted-foreground">(opcional)</span></label>
              <select id="appointment-professional" value={staffId} className={fieldClass} disabled={!serviceId} onChange={event => { setStaffId(event.target.value); setHour(""); }}>
                <option value="">Sin asignar · revisar después</option>
                {professionals.filter(s => s.active && [services.find(service => service.id === serviceId)?.category === "grooming" ? "groomer" : "vet", "admin"].includes(s.role)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Al elegir un profesional se muestran sus turnos compatibles con el servicio, sus ausencias y las demás atenciones.</p>
              {staffError && <p className="text-xs text-amber-800">{staffError}</p>}
            </div>
            </FormSection>
            <FormSection title="Fecha y hora" description="Horarios en hora de Colombia. La disponibilidad se confirma al guardar.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="appointment-date" className="text-sm font-semibold">Fecha</label>
                <Input id="appointment-date" type="date" value={dateKey} {...feedback.fieldProps("appointment-date")} onChange={(event) => { feedback.clearField("appointment-date"); feedback.clearField("appointment-hour"); setDateKey(event.target.value); setHour(""); }} required />
                <FieldError id="appointment-date" message={feedback.errors["appointment-date"]} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="appointment-hour" className="text-sm font-semibold">Hora de Colombia</label>
                <select id="appointment-hour" className={fieldClass} value={hour} {...feedback.fieldProps("appointment-hour")} onChange={(event) => { feedback.clearField("appointment-hour"); setHour(event.target.value); }} disabled={!serviceId || loadingSlots || Boolean(currentSlots?.error) || availableHours.length === 0} required>
                  <option value="">{loadingSlots ? "Consultando horarios…" : "Selecciona una hora"}</option>
                  {availableHours.map((value) => <option key={value} value={value}>{hourLabel(value)}</option>)}
                </select>
                <FieldError id="appointment-hour" message={feedback.errors["appointment-hour"]} />
              </div>
            </div>
            <div aria-live="polite" className="text-xs text-muted-foreground">
              {currentSlots?.error ? <span className="text-red-700">{currentSlots.error} <button type="button" className="font-semibold underline" onClick={() => setSlotVersion((version) => version + 1)}>Reintentar</button></span>
                : serviceId && dateKey && !loadingSlots && availableHours.length === 0 ? "No hay turnos disponibles ese día. Prueba otra fecha."
                  : "Solo se muestran turnos disponibles para el servicio y la fecha elegidos. La disponibilidad se confirma al guardar."}
            </div>
            </FormSection>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          </fieldset>
          </FormDialogBody>
          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={() => discard(onClose)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving || loadingClient || loadingServices || loadingSlots || Boolean(currentSlots?.error) || Boolean(serviceId && dateKey && currentSlots && availableHours.length === 0)}>
              {saving ? "Guardando…" : "Crear cita"}
            </Button>
          </FormDialogFooter>
        </form>
        {registration === "owner" && <NewOwnerPetsSheet open onOpenChange={open => { if (!open) { setRegistration(null); setSlotVersion(value => value + 1); } }} onCreated={created => { setClient(created.owner); setQuery(created.owner.name ?? created.owner.phone); setPets(created.pets); setPetId(created.pets[0]?.id ?? ""); setMatches([]); setError(null); }} />}
        {registration === "pet" && client && <NewPetSheet open lockOwner defaultOwnerPhone={client.phone} defaultOwnerName={client.name ?? ""} onOpenChange={open => { if (!open) { setRegistration(null); setSlotVersion(value => value + 1); } }} onCreated={pet => { if (pet.userId && pet.userId !== client.id) { setError("La mascota no pertenece al cliente seleccionado. Revisa su ficha."); return; } setPets(rows => [...rows.filter(row => row.id !== pet.id), pet]); setPetId(pet.id); setError(null); }} />}
      </FormDialogContent>
  );
}

export function NewAppointmentDialog(props: NewAppointmentProps) {
  return <ProtectedDialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
    <NewAppointmentContent {...props} />
  </ProtectedDialog>;
}
