"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { proxyUrl } from "@/lib/api";
import { formatPetType } from "@/lib/pets";
import { useTenant, tenantQuery } from "@/lib/use-tenant";
import { useToast } from "@/components/ui/toast";
import { ProtectedDialog, useDialogEditGuard } from "@/components/dashboard/protected-dialog";

type Client = { id: string; name: string | null; phone: string };
type Pet = { id: string; name: string; type: string };
type Service = {
  id: string;
  name: string;
  category: string | null;
  active: boolean;
  requiresAppointment: boolean;
};

function hourLabel(hour: number) {
  return `${String(Math.floor(hour)).padStart(2, "0")}:${Number.isInteger(hour) ? "00" : "30"}`;
}

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
  const router = useRouter();
  const contactsHref = `/dashboard/contacto${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ""}`;
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [initialQuery, setInitialQuery] = useState("");
  const [matches, setMatches] = useState<Client[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState("");
  const access = useDashboardAccess();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [dateKey, setDateKey] = useState(initialDate);
  const [hour, setHour] = useState("");
  const [slotVersion, setSlotVersion] = useState(0);
  const [slotResult, setSlotResult] = useState<{ key: string; slots: number[]; error: string | null } | null>(null);
  const [loadingClient, setLoadingClient] = useState(Boolean(initialClientId || initialPetId));
  const [loadingServices, setLoadingServices] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slotKey = `${tenant ?? ""}:${serviceId}:${dateKey}:${slotVersion}`;
  const currentSlots = slotResult?.key === slotKey ? slotResult : null;
  const availableHours = currentSlots?.slots ?? [];
  const loadingSlots = Boolean(serviceId && dateKey && !currentSlots);
  const dirty = Boolean(serviceId || hour || dateKey !== initialDate ||
    (petId && petId !== initialPetId) || query !== initialQuery);
  const discard = useDialogEditGuard(dirty, saving);

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
    const params = new URLSearchParams({ serviceId, dateKey });
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
        if (!controller.signal.aborted) setSlotResult({
          key: slotKey, slots: Array.isArray(payload.slots) ? payload.slots : [], error: null,
        });
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setSlotResult({
          key: slotKey, slots: [], error: cause instanceof Error ? cause.message : "No se pudieron consultar los horarios",
        });
      });
    return () => controller.abort();
  }, [serviceId, dateKey, tenant, slotVersion, slotKey]);

  async function selectClient(selected: Client) {
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
    if (!client || !petId || !serviceId || !dateKey || !hour) {
      setError("Completa cliente, mascota, servicio, fecha y hora.");
      return;
    }
    if (!availableHours.includes(Number(hour))) {
      setError("Elige uno de los horarios disponibles para esta fecha y servicio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/appointments${tenantQuery(tenant)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: client.id, petId, serviceId, dateKey, hour: Number(hour) }),
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
      setError(cause instanceof Error ? cause.message : "No se pudo crear la cita");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><CalendarPlus className="h-5 w-5" /></span>
            <div>
              <DialogTitle>Nueva cita</DialogTitle>
              <DialogDescription>Registra una cita para un cliente y una mascota existentes.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={submit}>
          <fieldset disabled={saving} className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <label htmlFor="appointment-client" className="text-sm font-semibold">Cliente</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="appointment-client" value={query} autoComplete="off" disabled={loadingClient || saving} placeholder="Busca por nombre o teléfono"
                  onChange={(event) => { setQuery(event.target.value); setClient(null); setPetId(""); setPets([]); setMatches([]); }} className="pl-9" />
              </div>
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
              <p className="text-xs text-muted-foreground">{access?.capabilities.contacts ? <>¿No aparece? <Link href={contactsHref} onClick={(event) => { event.preventDefault(); discard(() => router.push(contactsHref)); }} className="font-semibold text-teal-700 underline">Regístralo en Clientes y mascotas</Link>.</> : "Si faltan el cliente o la mascota, solicita su registro al administrador."}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="appointment-pet" className="text-sm font-semibold">Mascota</label>
              <select id="appointment-pet" className={fieldClass} value={petId} onChange={(event) => setPetId(event.target.value)} disabled={!client || loadingClient} required>
                <option value="">{loadingClient ? "Cargando mascotas…" : "Selecciona una mascota"}</option>
                {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} · {formatPetType(pet.type)}</option>)}
              </select>
              {client && !loadingClient && pets.length === 0 && <p className="text-xs text-amber-700">Este cliente todavía no tiene mascotas registradas.</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="appointment-service" className="text-sm font-semibold">Servicio</label>
              <select id="appointment-service" className={fieldClass} value={serviceId} onChange={(event) => { setServiceId(event.target.value); setHour(""); }} disabled={loadingServices} required>
                <option value="">{loadingServices ? "Cargando servicios…" : "Selecciona un servicio"}</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
              {!loadingServices && services.length === 0 && <p className="text-xs text-amber-700">No hay servicios con cita activos.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="appointment-date" className="text-sm font-semibold">Fecha</label>
                <Input id="appointment-date" type="date" value={dateKey} onChange={(event) => { setDateKey(event.target.value); setHour(""); }} required />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="appointment-hour" className="text-sm font-semibold">Hora · Bogotá</label>
                <select id="appointment-hour" className={fieldClass} value={hour} onChange={(event) => setHour(event.target.value)} disabled={!serviceId || loadingSlots || Boolean(currentSlots?.error) || availableHours.length === 0} required>
                  <option value="">{loadingSlots ? "Consultando horarios…" : "Selecciona una hora"}</option>
                  {availableHours.map((value) => <option key={value} value={value}>{hourLabel(value)}</option>)}
                </select>
              </div>
            </div>
            <div aria-live="polite" className="text-xs text-muted-foreground">
              {currentSlots?.error ? <span className="text-red-700">{currentSlots.error} <button type="button" className="font-semibold underline" onClick={() => setSlotVersion((version) => version + 1)}>Reintentar</button></span>
                : serviceId && dateKey && !loadingSlots && availableHours.length === 0 ? "No hay turnos disponibles ese día. Prueba otra fecha."
                  : "Solo se muestran turnos disponibles para el servicio y la fecha elegidos. La disponibilidad se confirma al guardar."}
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => discard(onClose)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving || loadingClient || loadingServices || loadingSlots || !client || !petId || !serviceId || !dateKey || !hour || Boolean(currentSlots?.error)}>
              {saving ? "Guardando…" : "Crear cita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
  );
}

export function NewAppointmentDialog(props: NewAppointmentProps) {
  return <ProtectedDialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
    <NewAppointmentContent {...props} />
  </ProtectedDialog>;
}
