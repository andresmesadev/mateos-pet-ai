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
import { type TenantProfile, type ServiceRow } from "@/app/dashboard/settings/page";

// ── Constants ─────────────────────────────────────────────────

const DAYS = [
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
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Datos del negocio</CardTitle></CardHeader>
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

function ServiceCard({ service, onUpdated }: { service: ServiceRow; onUpdated: (s: ServiceRow) => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(String(service.duration));
  const [basePrice, setBasePrice] = useState(service.basePrice != null ? String(service.basePrice) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/services/${service.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), duration: parseInt(duration) || service.duration, basePrice: basePrice ? Number(basePrice) : null }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdated({ ...service, ...updated, basePrice: updated.basePrice != null ? Number(updated.basePrice) : null });
      setEditing(false);
    } catch {
      toast("No se pudo guardar el servicio.", "error");
    } finally { setSaving(false); }
  }

  async function toggleActive() {
    if (service.active && !window.confirm(`¿Desactivar "${service.name}"?`)) return;
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/services/${service.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !service.active }),
      });
      if (!res.ok) throw new Error();
      onUpdated({ ...service, active: !service.active });
    } catch {
      toast("No se pudo actualizar el servicio.", "error");
    }
  }

  return (
    <li className={`rounded-lg border px-3 py-2.5 ${service.active ? "bg-background" : "bg-muted/30 opacity-60"}`}>
      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_80px_110px] gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Min" />
            <Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="Precio base" />
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
                <span className="text-xs font-medium text-green-700 dark:text-green-400">{formatCOP(service.basePrice)}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>Editar</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={toggleActive}>
              {service.active ? "Desactivar" : "Activar"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function AddServiceForm({ onAdded }: { onAdded: (s: ServiceRow) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("veterinary");
  const [duration, setDuration] = useState("30");
  const [basePrice, setBasePrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleAdd() {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/services"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category, duration: parseInt(duration) || 30, basePrice: basePrice ? Number(basePrice) : null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Error");
      const created = await res.json();
      onAdded({ ...created, basePrice: created.basePrice != null ? Number(created.basePrice) : null });
      setName(""); setBasePrice(""); setDuration("30");
      toast("Servicio creado.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="text-xs font-medium text-muted-foreground">Nuevo servicio</p>
      <div className="grid grid-cols-[1fr_120px_80px_110px] gap-2">
        <Input placeholder="Nombre del servicio" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="veterinary">Veterinaria</option>
          <option value="grooming">Peluquería</option>
          <option value="other">Otro</option>
        </select>
        <Input type="number" placeholder="Min" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <Input type="number" placeholder="Precio base" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
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

  const update = (u: ServiceRow) => setServices((prev) => prev.map((x) => x.id === u.id ? u : x));
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
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Dirección</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle 123 # 45-67, Bogotá" />
          <Button size="sm" onClick={saveAddress} disabled={saving}>{saving ? "Guardando…" : "Guardar dirección"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Servicios ofrecidos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <AddServiceForm onAdded={(s) => setServices((prev) => [s, ...prev])} />

          {active.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activos ({active.length})</p>
              <ul className="space-y-2">{active.map((s) => <ServiceCard key={s.id} service={s} onUpdated={update} />)}</ul>
            </div>
          )}
          {inactive.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inactivos ({inactive.length})</p>
              <ul className="space-y-2">{inactive.map((s) => <ServiceCard key={s.id} service={s} onUpdated={update} />)}</ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── 3. Agenda y disponibilidad ─────────────────────────────────

type BusinessHours = Record<string, { open: string; close: string; active: boolean }>;

export function ScheduleSection({ profile }: { profile: TenantProfile | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const tenant = useTenant();

  const [hours, setHours] = useState<BusinessHours>(() => {
    const base: BusinessHours = {};
    for (const { key } of DAYS) {
      base[key] = profile?.businessHours?.[key] ?? { ...DEFAULT_HOURS };
    }
    return base;
  });
  const [saving, setSaving] = useState(false);

  function setDay(key: string, field: "open" | "close" | "active", value: string | boolean) {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await saveTenantProfile(tenant, { businessHours: hours });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Error");
      toast("Horarios guardados.", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al guardar", "error");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Horarios de atención</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {DAYS.map(({ key, label }) => {
              const day = hours[key];
              return (
                <div key={key} className="grid grid-cols-[110px_1fr_1fr_60px] gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={day.active} onChange={(e) => setDay(key, "active", e.target.checked)} className="h-4 w-4 rounded border-input" />
                    <span className={`text-sm ${day.active ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
                  </div>
                  <Input type="time" value={day.open} disabled={!day.active} onChange={(e) => setDay(key, "open", e.target.value)} className="text-sm disabled:opacity-40" />
                  <Input type="time" value={day.close} disabled={!day.active} onChange={(e) => setDay(key, "close", e.target.value)} className="text-sm disabled:opacity-40" />
                  <span className="text-xs text-muted-foreground">{day.active ? "–" : "Cerrado"}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar horarios"}</Button>
    </div>
  );
}

// ── 4. Perfil fiscal ───────────────────────────────────────────

export function FiscalSection({ profile }: { profile: TenantProfile | null }) {
  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Datos fiscales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center">
            <p className="text-sm font-medium">Perfil fiscal</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Próximamente podrás configurar NIT, régimen IVA y responsabilidades fiscales para facturación electrónica.
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between border-b border-white/[0.06] py-1.5">
              <span>Nombre</span><span className="font-medium text-foreground">{profile?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b border-white/[0.06] py-1.5">
              <span>Teléfono</span><span className="font-medium text-foreground">{profile?.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b border-white/[0.06] py-1.5">
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
