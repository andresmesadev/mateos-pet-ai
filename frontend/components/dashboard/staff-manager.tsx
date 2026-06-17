"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { proxyUrl } from "@/lib/api";
import { useTenant } from "@/lib/use-tenant";

type DaySlot = { open: string; close: string; active: boolean };
type Availability = Record<string, DaySlot>;

type StaffMember = {
  id: string;
  tenantId: string | null;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  availability: Availability | null;
};

const ROLES = [
  { value: "vet", label: "Veterinario/a" },
  { value: "groomer", label: "Peluquero/a" },
  { value: "admin", label: "Administrativo/a" },
];

const DAYS = [
  { key: "mon", label: "Lun" },
  { key: "tue", label: "Mar" },
  { key: "wed", label: "Mié" },
  { key: "thu", label: "Jue" },
  { key: "fri", label: "Vie" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
];

const DEFAULT_SLOT: DaySlot = { open: "08:00", close: "18:00", active: true };

function buildDefaultAvailability(): Availability {
  const base: Availability = {};
  for (const { key } of DAYS) base[key] = { ...DEFAULT_SLOT };
  base.sun = { ...DEFAULT_SLOT, active: false };
  return base;
}

// ── Availability panel ────────────────────────────────────────

function AvailabilityPanel({ staffId, initial, onSaved }: {
  staffId: string;
  initial: Availability | null;
  onSaved: (av: Availability) => void;
}) {
  const [av, setAv] = useState<Availability>(() => initial ?? buildDefaultAvailability());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setDay(key: string, field: keyof DaySlot, value: string | boolean) {
    setSaved(false);
    setAv((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/staff/${staffId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: av }),
      });
      if (res.ok) {
        setSaved(true);
        onSaved(av);
      }
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <div className="mt-3 rounded-lg border bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Disponibilidad semanal</p>
      <div className="space-y-1.5">
        {DAYS.map(({ key, label }) => {
          const day = av[key] ?? { ...DEFAULT_SLOT, active: false };
          return (
            <div key={key} className="grid grid-cols-[40px_80px_auto_auto] gap-2 items-center">
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={day.active}
                  onChange={(e) => setDay(key, "active", e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-input"
                />
                <span className={`text-xs ${day.active ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
              </div>
              <input
                type="time"
                value={day.open}
                disabled={!day.active}
                onChange={(e) => setDay(key, "open", e.target.value)}
                className="h-7 w-full rounded border border-input bg-background px-2 text-xs disabled:opacity-40"
              />
              <input
                type="time"
                value={day.close}
                disabled={!day.active}
                onChange={(e) => setDay(key, "close", e.target.value)}
                className="h-7 w-full rounded border border-input bg-background px-2 text-xs disabled:opacity-40"
              />
              {!day.active && <span className="text-xs text-muted-foreground">Cerrado</span>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs px-3">
          {saving ? "Guardando…" : "Guardar horario"}
        </Button>
        {saved && <span className="text-xs text-green-600">Guardado</span>}
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  vet: "Veterinario/a",
  groomer: "Peluquero/a",
  admin: "Administrativo/a",
};

type NewForm = { name: string; role: string; phone: string; email: string };
type EditForm = { name: string; role: string; phone: string; email: string };

const EMPTY_FORM: NewForm = { name: "", role: "vet", phone: "", email: "" };

export function StaffManager() {
  const tenant = useTenant();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState<NewForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [availabilityOpenId, setAvailabilityOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchStaff() {
    const res = await fetch(proxyUrl("/api/dashboard/staff"), {
      cache: "no-store",
    });
    const data = await res.json();
    return Array.isArray(data) ? (data as StaffMember[]) : [];
  }

  async function reload() {
    try {
      setMembers(await fetchStaff());
    } catch {
      setMembers([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) setLoading(true);
      try {
        const data = await fetchStaff();
        if (!cancelled) setMembers(data);
      } catch {
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  async function handleCreate() {
    if (!newForm.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/staff"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newForm.name.trim(),
          role: newForm.role,
          phone: newForm.phone.trim() || null,
          email: newForm.email.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Error al crear");
      }
      setNewForm(EMPTY_FORM);
      setShowNew(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(m: StaffMember) {
    setEditingId(m.id);
    setEditForm({
      name: m.name,
      role: m.role,
      phone: m.phone ?? "",
      email: m.email ?? "",
    });
  }

  async function handleSaveEdit(id: string) {
    if (!editForm) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/staff/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          role: editForm.role,
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setEditingId(null);
      setEditForm(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(m: StaffMember) {
    try {
      await fetch(proxyUrl(`/api/dashboard/staff/${m.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !m.active }),
      });
      await reload();
    } catch {
      // silently ignore
    }
  }

  const grouped = ROLES.map((r) => ({
    ...r,
    items: members.filter((m) => m.role === r.value),
  }));

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Formulario nuevo miembro */}
      {showNew ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nuevo miembro del equipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Nombre completo"
              value={newForm.name}
              onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
            />
            <select
              value={newForm.role}
              onChange={(e) => setNewForm((f) => ({ ...f, role: e.target.value }))}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <Input
                placeholder="Teléfono (opcional)"
                value={newForm.phone}
                onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <Input
                type="email"
                placeholder="Email (opcional)"
                value={newForm.email}
                onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={saving || !newForm.name.trim()}>
                {saving ? "Guardando…" : "Crear"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowNew(false); setNewForm(EMPTY_FORM); }}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowNew(true)}>+ Nuevo miembro</Button>
        </div>
      )}

      {/* Lista por rol */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : (
        grouped.map((group) => (
          <Card key={group.value}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{group.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {group.items.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Sin miembros en este rol.
                </p>
              ) : (
                <ul className="divide-y">
                  {group.items.map((m) => (
                    <li key={m.id} className="px-4 py-3">
                      {editingId === m.id && editForm ? (
                        <div className="space-y-2">
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => f ? { ...f, name: e.target.value } : f)}
                          />
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm((f) => f ? { ...f, role: e.target.value } : f)}
                            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {ROLES.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <div className="flex gap-3">
                            <Input
                              placeholder="Teléfono"
                              value={editForm.phone}
                              onChange={(e) => setEditForm((f) => f ? { ...f, phone: e.target.value } : f)}
                            />
                            <Input
                              type="email"
                              placeholder="Email"
                              value={editForm.email}
                              onChange={(e) => setEditForm((f) => f ? { ...f, email: e.target.value } : f)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveEdit(m.id)} disabled={saving}>
                              {saving ? "Guardando…" : "Guardar"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditForm(null); }}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-medium ${!m.active ? "text-muted-foreground line-through" : ""}`}>
                                  {m.name}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {ROLE_LABELS[m.role] ?? m.role}
                                </Badge>
                              </div>
                              <div className="mt-0.5 flex gap-3 text-sm text-muted-foreground">
                                {m.phone && <span>{m.phone}</span>}
                                {m.email && <span>{m.email}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="sm" variant="ghost" onClick={() => startEdit(m)}>
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground"
                                onClick={() => setAvailabilityOpenId(availabilityOpenId === m.id ? null : m.id)}
                              >
                                {availabilityOpenId === m.id ? "Cerrar horario" : "Horario"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={m.active ? "text-muted-foreground" : "text-green-600"}
                                onClick={() => handleToggleActive(m)}
                              >
                                {m.active ? "Desactivar" : "Activar"}
                              </Button>
                            </div>
                          </div>
                          {availabilityOpenId === m.id && (
                            <AvailabilityPanel
                              staffId={m.id}
                              initial={m.availability}
                              onSaved={(av) => setMembers((prev) => prev.map((s) => s.id === m.id ? { ...s, availability: av } : s))}
                            />
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
