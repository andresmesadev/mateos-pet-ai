"use client";

import { useEffect, useState } from "react";

import { TenantSheet } from "@/components/dashboard/tenant-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { apiUrl } from "@/lib/api";
import {
  type Tenant,
  PLAN_LABELS,
  PLAN_OPTIONS,
  formatTenantCreatedAt,
} from "@/lib/tenants";

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function CreateTenantForm({ onCreated }: { onCreated: (t: Tenant) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    phone: "",
    email: "",
    plan: "free",
  });

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(apiUrl("/api/dashboard/tenants"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Error al crear veterinaria");
      }

      const created: Tenant = await res.json();
      onCreated(created);
      setOpen(false);
      setForm({ name: "", slug: "", phone: "", email: "", plan: "free" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear veterinaria");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        + Nueva veterinaria
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border bg-background p-4 space-y-3"
    >
      <p className="text-sm font-medium">Nueva veterinaria</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          placeholder="Nombre"
          value={form.name}
          onChange={set("name")}
          required
        />
        <Input
          placeholder="slug (ej: clinic-bogota)"
          value={form.slug}
          onChange={set("slug")}
          required
        />
        <Input
          placeholder="Teléfono / Phone Number ID"
          value={form.phone}
          onChange={set("phone")}
          required
        />
        <Input
          placeholder="Email (opcional)"
          type="email"
          value={form.email}
          onChange={set("email")}
        />
        <select
          value={form.plan}
          onChange={set("plan")}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          {PLAN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Creando…" : "Crear veterinaria"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function TenantsTable() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(apiUrl("/api/dashboard/tenants"), {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("No se pudieron cargar las veterinarias");

        const data: Tenant[] = await res.json();
        if (!cancelled) {
          setTenants(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleRowClick = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  const handleSheetChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) setSelectedId(null);
  };

  const handleTenantUpdated = (updated: Tenant) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
    );
  };

  const handleTenantCreated = (created: Tenant) => {
    setTenants((prev) => [created, ...prev]);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tenants.length} veterinaria{tenants.length !== 1 ? "s" : ""} registrada
          {tenants.length !== 1 ? "s" : ""}
        </p>
        <CreateTenantForm onCreated={handleTenantCreated} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Veterinarias</CardTitle>
          <CardDescription>
            Todos los tenants activos e inactivos en la plataforma
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
              {error}
            </div>
          ) : tenants.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <p className="font-medium">No hay veterinarias registradas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crea la primera con el botón de arriba.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Registro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(tenant.id)}
                  >
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {tenant.slug}
                    </TableCell>
                    <TableCell className="text-sm">{tenant.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {PLAN_LABELS[tenant.plan] ?? tenant.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tenant.active ? (
                        <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-200">
                          Activo
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/20 border-red-200">
                          Suspendido
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatTenantCreatedAt(tenant.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TenantSheet
        tenantId={selectedId}
        open={sheetOpen}
        onOpenChange={handleSheetChange}
        onUpdated={handleTenantUpdated}
      />
    </>
  );
}
