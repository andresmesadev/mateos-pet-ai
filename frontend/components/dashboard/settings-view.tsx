"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  grooming: "Grooming",
  other: "Otro",
};

// ── Textarea helper ───────────────────────────────────────────

function Textarea({ id, label, value, onChange, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────

type BusinessHours = Record<string, { open: string; close: string; active: boolean }>;

function ProfileTab({ profile }: { profile: TenantProfile | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(profile?.name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [hours, setHours] = useState<BusinessHours>(() => {
    const base: BusinessHours = {};
    for (const { key } of DAYS) {
      base[key] = profile?.businessHours?.[key] ?? { ...DEFAULT_HOURS };
    }
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setDay(key: string, field: "open" | "close" | "active", value: string | boolean) {
    setSaved(false);
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/tenant/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || null, description, address, businessHours: hours }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => null);
        throw new Error(p?.error ?? "Error al guardar");
      }
      setSaved(true);
      setError(null);
      toast("Cambios guardados.", "success");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Datos básicos */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Datos del negocio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="profile-name" className="text-xs font-medium text-muted-foreground">Nombre del centro</label>
            <Input id="profile-name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="Mateos Pet" />
          </div>
          <div className="space-y-1">
            <label htmlFor="profile-email" className="text-xs font-medium text-muted-foreground">Correo electrónico</label>
            <Input id="profile-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setSaved(false); }} placeholder="contacto@mateospet.com" />
          </div>
          <Textarea id="profile-description" label="Descripción" value={description} onChange={(v) => { setDescription(v); setSaved(false); }} placeholder="Clínica veterinaria y peluquería canina…" />
          <Textarea id="profile-address" label="Dirección" value={address} onChange={(v) => { setAddress(v); setSaved(false); }} placeholder="Calle 45 # 12-34, Bogotá" />
        </CardContent>
      </Card>

      {/* Horarios */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Horarios de atención</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {DAYS.map(({ key, label }) => {
              const day = hours[key];
              return (
                <div key={key} className="grid grid-cols-[100px_1fr_1fr_auto] gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={day.active}
                      onChange={(e) => setDay(key, "active", e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className={`text-sm ${day.active ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
                  </div>
                  <Input
                    type="time"
                    value={day.open}
                    disabled={!day.active}
                    onChange={(e) => setDay(key, "open", e.target.value)}
                    className="text-sm disabled:opacity-40"
                  />
                  <Input
                    type="time"
                    value={day.close}
                    disabled={!day.active}
                    onChange={(e) => setDay(key, "close", e.target.value)}
                    className="text-sm disabled:opacity-40"
                  />
                  {!day.active && <span className="text-xs text-muted-foreground">Cerrado</span>}
                  {day.active && <span className="text-xs text-muted-foreground">–</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
      {saved && <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">Perfil guardado correctamente.</p>}

      <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
    </div>
  );
}

// ── Service row ───────────────────────────────────────────────

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
        body: JSON.stringify({
          name: name.trim(),
          duration: parseInt(duration) || service.duration,
          basePrice: basePrice ? Number(basePrice) : null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdated({ ...service, ...updated, basePrice: updated.basePrice != null ? Number(updated.basePrice) : null });
      setEditing(false);
    } catch {
      toast("No se pudo guardar el servicio. Intenta de nuevo.", "error");
    } finally { setSaving(false); }
  }

  async function toggleActive() {
    if (service.active) {
      const confirmed = window.confirm(`¿Desactivar "${service.name}"? Los clientes no podrán agendarlo.`);
      if (!confirmed) return;
    }
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/services/${service.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !service.active }),
      });
      if (!res.ok) throw new Error();
      onUpdated({ ...service, active: !service.active });
    } catch {
      toast(`No se pudo ${service.active ? "desactivar" : "activar"} el servicio`, "error");
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

// ── Add service form ──────────────────────────────────────────

function AddServiceForm({ onAdded }: { onAdded: (s: ServiceRow) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("grooming");
  const [duration, setDuration] = useState("60");
  const [basePrice, setBasePrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) { setError("El nombre es requerido"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/services"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          duration: parseInt(duration) || 60,
          basePrice: basePrice ? Number(basePrice) : null,
        }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => null);
        throw new Error(p?.error ?? "Error al crear");
      }
      const created = await res.json();
      onAdded({ ...created, basePrice: created.basePrice != null ? Number(created.basePrice) : null });
      setName(""); setBasePrice(""); setDuration("60");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="text-xs font-medium text-muted-foreground">Nuevo servicio</p>
      <div className="grid grid-cols-[1fr_120px_80px_110px] gap-2">
        <Input placeholder="Nombre del servicio" value={name} onChange={(e) => setName(e.target.value)} />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="grooming">Grooming</option>
          <option value="veterinary">Veterinaria</option>
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

// ── Services tab ──────────────────────────────────────────────

function ServicesTab({ services: initial }: { services: ServiceRow[] }) {
  const [services, setServices] = useState(initial);

  function update(updated: ServiceRow) {
    setServices((prev) => prev.map((s) => s.id === updated.id ? updated : s));
  }

  const active = services.filter((s) => s.active);
  const inactive = services.filter((s) => !s.active);

  return (
    <div className="space-y-4 max-w-2xl">
      <AddServiceForm onAdded={(s) => setServices((prev) => [s, ...prev])} />

      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activos ({active.length})</p>
          <ul className="space-y-2">
            {active.map((s) => <ServiceCard key={s.id} service={s} onUpdated={update} />)}
          </ul>
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inactivos ({inactive.length})</p>
          <ul className="space-y-2">
            {inactive.map((s) => <ServiceCard key={s.id} service={s} onUpdated={update} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────

type Tab = "profile" | "services";

export function SettingsView({ profile, services }: { profile: TenantProfile | null; services: ServiceRow[] }) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        {([["profile", "Perfil del negocio"], ["services", "Servicios"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors
              ${tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab profile={profile} />}
      {tab === "services" && <ServicesTab services={services} />}
    </div>
  );
}
