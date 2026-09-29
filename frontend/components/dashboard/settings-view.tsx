"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant, tenantQuery } from "@/lib/use-tenant";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { formatCOP } from "@/lib/transactions";
import { type BusinessHourDay, type BusinessHours, type DayHours, type TenantProfile, type ServiceRow } from "@/app/dashboard/settings/page";
import { AgendaExceptionsManager } from "@/components/dashboard/agenda-exceptions-manager";

// ── Constants ─────────────────────────────────────────────────

const DAYS: Array<{ key: BusinessHourDay; label: string }> = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

const DEFAULT_HOURS = { open: "08:00", close: "18:00", active: true };

const CATEGORY_LABELS: Record<string, string> = {
  veterinary: "Veterinaria",
  grooming: "Peluquería",
  other: "Otro",
};

// ── Shared save helper ─────────────────────────────────────────

async function saveTenantProfile(tenant: string | null, data: Record<string, unknown>) {
  return fetch(proxyUrl(`/api/dashboard/tenant/profile${tenantQuery(tenant)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ── 1. Información general ────────────────────────────────────

export function GeneralInfoSection({ profile }: { profile: TenantProfile | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const tenant = useTenant();

  const [name, setName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await saveTenantProfile(tenant, { name: name.trim(), phone: phone.trim(), email: email.trim() || null, description: description.trim() || null });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Error");
      toast("Información guardada.", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Card className="border border-black/[0.10] border-t-2 border-t-slate-400/50">
        <CardHeader className="pb-3 border-b border-black/[0.06]"><CardTitle className="text-sm">Datos del negocio</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre o Razón social</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mateos Pet" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teléfono / WhatsApp</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+57 300 000 0000" />
            <p className="text-xs text-muted-foreground">Número principal de contacto y agente IA</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Correo electrónico</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="clinica@email.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción del negocio..."
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
        <p className="text-xs text-muted-foreground">Plan actual: <span className="font-semibold capitalize">{profile?.plan ?? "free"}</span></p>
      </div>
    </div>
  );
}

// ── 2. Localización y servicios ────────────────────────────────

function ServiceCard({ service, onUpdated, onRemoved }: { service: ServiceRow; onUpdated: (s: ServiceRow) => void; onRemoved: (id: string) => void }) {
  const { toast } = useToast();
  const tenant = useTenant();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(String(service.duration));
  const [basePrice, setBasePrice] = useState(service.basePrice != null ? String(service.basePrice) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast("Escribe un nombre para el servicio.", "error"); return; }
    if (name.trim().length > 100) { toast("El nombre no puede superar 100 caracteres.", "error"); return; }
    if (!Number.isInteger(Number(duration)) || Number(duration) <= 0) { toast("La duración debe ser mayor a cero.", "error"); return; }
    if (basePrice && (!Number.isFinite(Number(basePrice)) || Number(basePrice) < 0)) { toast("El precio no puede ser negativo.", "error"); return; }
    const nextPrice = basePrice ? Number(basePrice) : null;
    const currentPrice = service.basePrice == null ? null : Number(service.basePrice);
    const changes: Record<string, string | number | null> = {};
    if (name.trim() !== service.name) changes.name = name.trim();
    if (Number(duration) !== service.duration) changes.duration = Number(duration);
    if (nextPrice !== currentPrice) changes.basePrice = nextPrice;
    if (Object.keys(changes).length === 0) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/services/${service.id}${tenantQuery(tenant)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "No se pudo guardar el servicio.");
      }
      const updated = await res.json();
      onUpdated({ ...service, ...updated, basePrice: updated.basePrice != null ? Number(updated.basePrice) : null });
      setEditing(false);
      toast("Servicio actualizado.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "No se pudo guardar el servicio.", "error");
    } finally { setSaving(false); }
  }

  async function reactivate() {
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/services/${service.id}${tenantQuery(tenant)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      if (!res.ok) throw new Error();
      onUpdated({ ...service, active: true });
      toast("Servicio reactivado.", "success");
    } catch {
      toast("No se pudo reactivar el servicio.", "error");
    }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar "${service.name}" del catálogo activo? Se conservará el historial y podrás reactivarlo desde Servicios retirados.`)) return;
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/services/${service.id}${tenantQuery(tenant)}`), { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "No se pudo retirar el servicio.");
      }
      onRemoved(service.id);
      toast("Servicio retirado del catálogo activo.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "No se pudo retirar el servicio.", "error");
    }
  }

  return (
    <li className={`rounded-lg border px-3 py-2.5 ${service.active ? "bg-background" : "bg-muted/30 opacity-60"}`}>
      {editing ? (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium">
              <span>Nombre del servicio</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
            </label>
            <label className="space-y-1 text-xs font-medium">
              <span>Duración (minutos)</span>
              <Input type="number" min="1" step="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-medium sm:col-span-2">
              <span>Precio base (COP)</span>
              <Input type="number" min="0" step="1" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="Ej. 66000" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "…" : "Guardar"}</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{service.name}</span>
              <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[service.category] ?? service.category}</Badge>
              <span className="text-xs text-muted-foreground">{service.duration} min</span>
              {service.basePrice != null && (
                <span className="text-xs font-medium text-green-700 dark:text-green-700">{formatCOP(service.basePrice)}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>Editar</Button>
            {service.active ? (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-700 hover:bg-red-50 hover:text-red-800" onClick={remove}>Eliminar</Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={reactivate}>Reactivar</Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function AddServiceForm({ onAdded }: { onAdded: (s: ServiceRow) => void }) {
  const tenant = useTenant();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("veterinary");
  const [duration, setDuration] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleAdd() {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    if (!Number.isInteger(Number(duration)) || Number(duration) <= 0) { setError("Indica la duración en minutos."); return; }
    if (basePrice && (!Number.isFinite(Number(basePrice)) || Number(basePrice) < 0)) { setError("El precio base debe ser un valor válido en pesos."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/services${tenantQuery(tenant)}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category, duration: Number(duration), basePrice: basePrice ? Number(basePrice) : null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Error");
      const created = await res.json();
      onAdded({ ...created, basePrice: created.basePrice != null ? Number(created.basePrice) : null });
      setName(""); setBasePrice(""); setDuration("");
      toast("Servicio creado.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="text-xs font-medium text-muted-foreground">Nuevo servicio</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium">
          <span>Nombre del servicio</span>
          <Input placeholder="Ej. Consulta veterinaria" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span>Categoría</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="veterinary">Veterinaria</option>
            <option value="grooming">Peluquería</option>
            <option value="other">Otro</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span>Duración (minutos)</span>
          <Input type="number" min="1" step="1" placeholder="Ej. 30" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span>Precio base (COP)</span>
          <Input type="number" min="0" step="1" placeholder="Ej. 66000" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
        </label>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="sm" onClick={handleAdd} disabled={saving}>{saving ? "Creando…" : "+ Crear servicio"}</Button>
    </div>
  );
}

export function LocationServicesSection({ profile, services: initial }: { profile: TenantProfile | null; services: ServiceRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const tenant = useTenant();
  const [address, setAddress] = useState(profile?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState(initial);
  const [showInactive, setShowInactive] = useState(false);

  const update = (u: ServiceRow) => setServices((prev) => prev.map((x) => x.id === u.id ? u : x));
  const remove = (id: string) => setServices((prev) => prev.map((service) => service.id === id ? { ...service, active: false } : service));
  const active = services.filter((s) => s.active);
  const inactive = services.filter((s) => !s.active);

  async function saveAddress() {
    setSaving(true);
    try {
      const res = await saveTenantProfile(tenant, { address: address.trim() || null });
      if (!res.ok) throw new Error();
      toast("Dirección guardada.", "success");
      router.refresh();
    } catch {
      toast("Error al guardar la dirección.", "error");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="border border-black/[0.10] border-t-2 border-t-slate-400/50">
        <CardHeader className="pb-3 border-b border-black/[0.06]"><CardTitle className="text-sm">Dirección</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle 123 # 45-67, Bogotá" />
          <Button size="sm" onClick={saveAddress} disabled={saving}>{saving ? "Guardando…" : "Guardar dirección"}</Button>
        </CardContent>
      </Card>

      <Card className="border border-black/[0.10] border-t-2 border-t-slate-400/50">
        <CardHeader className="pb-3 border-b border-black/[0.06]"><CardTitle className="text-sm">Servicios ofrecidos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <AddServiceForm onAdded={(s) => setServices((prev) => [s, ...prev])} />

          {active.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activos ({active.length})</p>
              <ul className="space-y-2">{active.map((s) => <ServiceCard key={s.id} service={s} onUpdated={update} onRemoved={remove} />)}</ul>
            </div>
          )}
          {inactive.length > 0 && <button type="button" aria-expanded={showInactive} onClick={() => setShowInactive((value) => !value)} className="text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {showInactive ? "Ocultar" : "Mostrar"} servicios retirados ({inactive.length})
          </button>}
          {showInactive && inactive.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Servicios retirados</p>
              <ul className="space-y-2">{inactive.map((s) => <ServiceCard key={s.id} service={s} onUpdated={update} onRemoved={remove} />)}</ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── 3. Agenda y disponibilidad ─────────────────────────────────

type HoursByDay = Record<BusinessHourDay, DayHours>;
type ServiceHours = Record<"vet" | "grooming", HoursByDay>;

function buildHours(source?: Partial<Record<BusinessHourDay, DayHours>> | null, fallback?: HoursByDay): HoursByDay {
  const base = {} as HoursByDay;
  for (const { key } of DAYS) {
    base[key] = source?.[key] ?? fallback?.[key] ?? { ...DEFAULT_HOURS };
  }
  return base;
}

function HoursEditor({
  hours,
  onChange,
}: {
  hours: HoursByDay;
  onChange: (key: BusinessHourDay, field: keyof DayHours, value: string | boolean) => void;
}) {
  return (
    <div className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const day = hours[key];
        return (
          <div key={key} className="grid grid-cols-[110px_1fr_1fr_60px] gap-2 items-center">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={day.active} onChange={(e) => onChange(key, "active", e.target.checked)} className="h-4 w-4 rounded border-input" />
              <span className={`text-sm ${day.active ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
            </div>
            <Input type="time" value={day.open} disabled={!day.active} onChange={(e) => onChange(key, "open", e.target.value)} className="text-sm disabled:opacity-40" />
            <Input type="time" value={day.close} disabled={!day.active} onChange={(e) => onChange(key, "close", e.target.value)} className="text-sm disabled:opacity-40" />
            <span className="text-xs text-muted-foreground">{day.active ? "–" : "Cerrado"}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ScheduleSection({ profile }: { profile: TenantProfile | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const tenant = useTenant();

  const [hours, setHours] = useState<HoursByDay>(() => buildHours(profile?.businessHours));
  const [serviceHours, setServiceHours] = useState<ServiceHours>(() => {
    const general = buildHours(profile?.businessHours);
    return {
      vet: buildHours(profile?.businessHours?.services?.vet, general),
      grooming: buildHours(profile?.businessHours?.services?.grooming, general),
    };
  });
  const [saving, setSaving] = useState(false);

  function setDay(key: BusinessHourDay, field: keyof DayHours, value: string | boolean) {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function setServiceDay(service: keyof ServiceHours, key: BusinessHourDay, field: keyof DayHours, value: string | boolean) {
    setServiceHours((prev) => ({
      ...prev,
      [service]: { ...prev[service], [key]: { ...prev[service][key], [field]: value } },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const businessHours: BusinessHours = { ...hours, services: serviceHours };
      const res = await saveTenantProfile(tenant, { businessHours });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Error");
      toast("Horarios guardados.", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al guardar", "error");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Card className="border border-black/[0.10] border-t-2 border-t-slate-400/50">
        <CardHeader className="pb-3 border-b border-black/[0.06]">
          <CardTitle className="text-sm">Horario general</CardTitle>
          <p className="text-xs text-muted-foreground">Es el horario base del establecimiento y del calendario administrativo.</p>
        </CardHeader>
        <CardContent>
          <HoursEditor hours={hours} onChange={setDay} />
        </CardContent>
      </Card>
      <Card className="border border-black/[0.10] border-t-2 border-t-teal-400/50">
        <CardHeader className="pb-3 border-b border-black/[0.06]">
          <CardTitle className="text-sm">Horario de veterinaria</CardTitle>
          <p className="text-xs text-muted-foreground">Define los días y horas en los que el agente puede ofrecer consultas veterinarias.</p>
        </CardHeader>
        <CardContent><HoursEditor hours={serviceHours.vet} onChange={(key, field, value) => setServiceDay("vet", key, field, value)} /></CardContent>
      </Card>
      <Card className="border border-black/[0.10] border-t-2 border-t-pink-400/50">
        <CardHeader className="pb-3 border-b border-black/[0.06]">
          <CardTitle className="text-sm">Horario de peluquería</CardTitle>
          <p className="text-xs text-muted-foreground">Define los días y horas de los turnos de peluquería; se conserva el orden consecutivo de la agenda.</p>
        </CardHeader>
        <CardContent><HoursEditor hours={serviceHours.grooming} onChange={(key, field, value) => setServiceDay("grooming", key, field, value)} /></CardContent>
      </Card>
      <AgendaExceptionsManager />
      <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar horarios"}</Button>
    </div>
  );
}

// ── 4. Perfil fiscal ───────────────────────────────────────────

export function FiscalSection({ profile }: { profile: TenantProfile | null }) {
  return (
    <div className="max-w-xl space-y-4">
      <Card className="border border-black/[0.10] border-t-2 border-t-slate-400/50">
        <CardHeader className="pb-3 border-b border-black/[0.06]"><CardTitle className="text-sm">Datos fiscales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center">
            <p className="text-sm font-medium">Perfil fiscal</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Próximamente podrás configurar NIT, régimen IVA y responsabilidades fiscales para facturación electrónica.
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between border-b border-black/[0.06] py-1.5">
              <span>Nombre</span><span className="font-medium text-foreground">{profile?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b border-black/[0.06] py-1.5">
              <span>Teléfono</span><span className="font-medium text-foreground">{profile?.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b border-black/[0.06] py-1.5">
              <span>Email</span><span className="font-medium text-foreground">{profile?.email ?? "—"}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span>Plan</span><span className="font-medium capitalize text-foreground">{profile?.plan ?? "free"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Legacy export (kept for backward compat) ──────────────────
export { LocationServicesSection as ServicesSection };
export function SettingsView({ profile }: { profile: TenantProfile | null }) {
  return <ScheduleSection profile={profile} />;
}
