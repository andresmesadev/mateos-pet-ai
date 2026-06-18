"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { proxyUrl } from "@/lib/api";
import {
  type Tenant,
  PLAN_LABELS,
  PLAN_OPTIONS,
  SUBSCRIPTION_STATUS_LABELS,
  formatTenantCreatedAt,
  formatPlanExpiresAt,
} from "@/lib/tenants";

type TenantSheetProps = {
  tenantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (tenant: Tenant) => void;
};

function SheetSkeleton() {
  return (
    <div className="space-y-6 px-4 pb-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function TenantSheetContent({
  tenantId,
  onUpdated,
}: {
  tenantId: string;
  onUpdated: (t: Tenant) => void;
}) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState("free");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(proxyUrl(`/api/dashboard/tenants/${tenantId}`), {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("No se pudo cargar la veterinaria");

        const data: Tenant = await res.json();
        if (!cancelled) {
          setTenant(data);
          setEditName(data.name);
          setEditPlan(data.plan);
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
  }, [tenantId]);

  const patch = async (data: Partial<Pick<Tenant, "name" | "plan" | "active">>) => {
    if (!tenant) return;
    setSaving(true);
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/tenants/${tenant.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Error al actualizar");

      const updated: Tenant = await res.json();
      const merged = { ...tenant, ...updated };
      setTenant(merged);
      onUpdated(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = () => {
    if (editName.trim() && editName !== tenant?.name) patch({ name: editName.trim() });
  };

  const handleSavePlan = () => {
    if (editPlan !== tenant?.plan) patch({ plan: editPlan });
  };

  if (loading) {
    return (
      <>
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>Cargando…</SheetTitle>
        </SheetHeader>
        <SheetSkeleton />
      </>
    );
  }

  if (error || !tenant) {
    return (
      <>
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>Veterinaria</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-8 text-sm text-destructive">
          {error ?? "Veterinaria no encontrada"}
        </div>
      </>
    );
  }

  const subStatus = tenant.subscriptionStatus
    ? SUBSCRIPTION_STATUS_LABELS[tenant.subscriptionStatus] ?? tenant.subscriptionStatus
    : null;

  return (
    <>
      <SheetHeader className="border-b px-4 py-4">
        <SheetTitle className="flex items-center gap-2">
          {tenant.name}
          {tenant.active ? (
            <Badge className="bg-green-500/10 text-green-700 border-green-200">
              Activo
            </Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-700 border-red-200">
              Suspendido
            </Badge>
          )}
        </SheetTitle>
        <SheetDescription>
          {tenant.slug} · Desde {formatTenantCreatedAt(tenant.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6 pt-4">

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3">
          {(
            [
              ["Usuarios", tenant._count.users],
              ["Mascotas", tenant._count.pets],
              ["Citas", tenant._count.appointments],
              ["Conversaciones", tenant._count.conversations ?? "—"],
            ] as [string, number | string][]
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border bg-muted/30 px-3 py-3 text-center"
            >
              <p className="text-2xl font-semibold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        {/* Billing */}
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Suscripción</h3>
          <div className="rounded-lg border px-3 py-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <Badge variant="outline">
                {PLAN_LABELS[tenant.plan] ?? tenant.plan}
              </Badge>
            </div>
            {subStatus ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estado Stripe</span>
                <span className="font-medium">{subStatus}</span>
              </div>
            ) : null}
            {tenant.planExpiresAt ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vence</span>
                <span>{formatPlanExpiresAt(tenant.planExpiresAt)}</span>
              </div>
            ) : null}
            {tenant.email ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{tenant.email}</span>
              </div>
            ) : null}
          </div>
        </section>

        {/* Edit name */}
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Nombre</h3>
          <div className="flex gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nombre de la veterinaria"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={saving || !editName.trim() || editName === tenant.name}
              onClick={handleSaveName}
            >
              Guardar
            </Button>
          </div>
        </section>

        {/* Change plan */}
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Cambiar plan</h3>
          <div className="flex gap-2">
            <select
              value={editPlan}
              onChange={(e) => setEditPlan(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {PLAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={saving || editPlan === tenant.plan}
              onClick={handleSavePlan}
            >
              Aplicar
            </Button>
          </div>
        </section>

        {/* Activate / Suspend */}
        <section className="flex gap-2">
          {tenant.active ? (
            <Button
              variant="destructive"
              className="w-full"
              disabled={saving}
              onClick={() => patch({ active: false })}
            >
              Suspender veterinaria
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={saving}
              onClick={() => patch({ active: true })}
            >
              Activar veterinaria
            </Button>
          )}
        </section>

      </div>
    </>
  );
}

export function TenantSheet({
  tenantId,
  open,
  onOpenChange,
  onUpdated,
}: TenantSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {open && tenantId ? (
          <TenantSheetContent
            key={tenantId}
            tenantId={tenantId}
            onUpdated={onUpdated}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
