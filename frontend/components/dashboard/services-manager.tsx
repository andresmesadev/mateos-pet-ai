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
import { apiUrl } from "@/lib/api";
import { useTenant, tenantQuery } from "@/lib/use-tenant";

type Service = {
  id: string;
  tenantId: string | null;
  name: string;
  category: string;
  duration: number;
  requiresAppointment: boolean;
  active: boolean;
};

const CATEGORIES = [
  { value: "veterinary", label: "Veterinaria" },
  { value: "grooming", label: "Peluquería" },
  { value: "other", label: "Otro" },
];

type NewForm = {
  name: string;
  category: string;
  duration: string;
  requiresAppointment: boolean;
};

const EMPTY_FORM: NewForm = {
  name: "",
  category: "veterinary",
  duration: "45",
  requiresAppointment: true,
};

type EditForm = {
  name: string;
  category: string;
  duration: string;
  requiresAppointment: boolean;
};

export function ServicesManager() {
  const tenant = useTenant();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState<NewForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchServices() {
    const res = await fetch(apiUrl(`/api/dashboard/services${tenantQuery(tenant)}`), {
      cache: "no-store",
    });
    const data = await res.json();
    return Array.isArray(data) ? (data as Service[]) : [];
  }

  async function load() {
    try {
      setServices(await fetchServices());
    } catch {
      setServices([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) setLoading(true);
      try {
        const data = await fetchServices();
        if (!cancelled) setServices(data);
      } catch {
        if (!cancelled) setServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  async function handleCreate() {
    if (!newForm.name.trim() || !newForm.duration) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/dashboard/services"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant ?? null,
          name: newForm.name.trim(),
          category: newForm.category,
          duration: Number(newForm.duration),
          requiresAppointment: newForm.requiresAppointment,
        }),
      });
      if (!res.ok) throw new Error("Error al crear servicio");
      setNewForm(EMPTY_FORM);
      setShowNew(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(svc: Service) {
    setEditingId(svc.id);
    setEditForm({
      name: svc.name,
      category: svc.category,
      duration: String(svc.duration),
      requiresAppointment: svc.requiresAppointment,
    });
  }

  async function handleSaveEdit(id: string) {
    if (!editForm) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/dashboard/services/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          category: editForm.category,
          duration: Number(editForm.duration),
          requiresAppointment: editForm.requiresAppointment,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setEditingId(null);
      setEditForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(svc: Service) {
    try {
      await fetch(apiUrl(`/api/dashboard/services/${svc.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !svc.active }),
      });
      await load();
    } catch {
      // silently ignore
    }
  }

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: services.filter((s) => s.category === cat.value),
  }));

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Formulario nuevo servicio */}
      {showNew ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nuevo servicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Nombre del servicio"
              value={newForm.name}
              onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="flex gap-3">
              <select
                value={newForm.category}
                onChange={(e) => setNewForm((f) => ({ ...f, category: e.target.value }))}
                className="h-9 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="Duración (min)"
                className="w-36"
                value={newForm.duration}
                onChange={(e) => setNewForm((f) => ({ ...f, duration: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newForm.requiresAppointment}
                onChange={(e) => setNewForm((f) => ({ ...f, requiresAppointment: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              Requiere cita previa
            </label>
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
          <Button size="sm" onClick={() => setShowNew(true)}>+ Nuevo servicio</Button>
        </div>
      )}

      {/* Lista por categoría */}
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
                <p className="px-4 py-3 text-sm text-muted-foreground">Sin servicios en esta categoría.</p>
              ) : (
                <ul className="divide-y">
                  {group.items.map((svc) => (
                    <li key={svc.id} className="px-4 py-3">
                      {editingId === svc.id && editForm ? (
                        <div className="space-y-2">
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => f ? { ...f, name: e.target.value } : f)}
                          />
                          <div className="flex gap-3">
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm((f) => f ? { ...f, category: e.target.value } : f)}
                              className="h-9 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                            <Input
                              type="number"
                              className="w-32"
                              value={editForm.duration}
                              onChange={(e) => setEditForm((f) => f ? { ...f, duration: e.target.value } : f)}
                            />
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editForm.requiresAppointment}
                              onChange={(e) => setEditForm((f) => f ? { ...f, requiresAppointment: e.target.checked } : f)}
                              className="h-4 w-4 accent-primary"
                            />
                            Requiere cita previa
                          </label>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveEdit(svc.id)} disabled={saving}>
                              {saving ? "Guardando…" : "Guardar"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditForm(null); }}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <span className={`font-medium ${!svc.active ? "text-muted-foreground line-through" : ""}`}>
                              {svc.name}
                            </span>
                            <span className="ml-2 text-sm text-muted-foreground">{svc.duration} min</span>
                            {!svc.requiresAppointment && (
                              <Badge variant="secondary" className="ml-2 text-xs">Sin cita</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(svc)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={svc.active ? "text-muted-foreground" : "text-green-600"}
                              onClick={() => handleToggleActive(svc)}
                            >
                              {svc.active ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
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
