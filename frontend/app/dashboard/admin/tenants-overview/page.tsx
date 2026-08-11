import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";

import { auth } from "@/auth";
import { proxyUrl } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";

export type TenantOverviewRow = {
  tenantId: string;
  name: string;
  plan: string;
  active: boolean;
  usersCount: number;
  appointmentsCount: number;
  conversationsCount: number;
  revenueTotal: number;
  expenseTotal: number;
  netTotal: number;
};

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// Entregable 6.6 (Fase 6) — Operación Centralizada, Fase A: capacidad
// administrativa de solo lectura y agregación cross-establecimiento.
// Solo accesible para un superadmin sin tenant seleccionado — no es un
// mecanismo general de impersonación ni un selector de tenant. La llamada
// pasa por el proxy Next.js (?viewAllTenants=1), como cualquier otra ruta
// de dashboard — no se llama al backend directo desde este componente.
export default async function TenantsOverviewPage() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) notFound();

  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${proxyUrl("/api/dashboard/tenants/overview")}?viewAllTenants=1`, {
    cache: "no-store",
    headers: { Cookie: cookieHeader },
  });

  const data: { tenants: TenantOverviewRow[] } | null = res.ok ? await res.json() : null;
  const tenants = data?.tenants ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operación centralizada"
        description="Resumen agregado, solo lectura, de todos los establecimientos activos"
        icon={Building2}
        tint="bg-indigo-500/15 text-indigo-400"
      />

      {!res.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          No se pudo cargar el resumen de establecimientos.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Establecimiento</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium text-right">Usuarios</th>
              <th className="px-4 py-2 font-medium text-right">Citas</th>
              <th className="px-4 py-2 font-medium text-right">Conversaciones</th>
              <th className="px-4 py-2 font-medium text-right">Ingresos</th>
              <th className="px-4 py-2 font-medium text-right">Gastos</th>
              <th className="px-4 py-2 font-medium text-right">Neto</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.tenantId} className="border-t">
                <td className="px-4 py-2">{t.name}</td>
                <td className="px-4 py-2">{t.plan}</td>
                <td className="px-4 py-2 text-right">{t.usersCount}</td>
                <td className="px-4 py-2 text-right">{t.appointmentsCount}</td>
                <td className="px-4 py-2 text-right">{t.conversationsCount}</td>
                <td className="px-4 py-2 text-right">{currency.format(t.revenueTotal)}</td>
                <td className="px-4 py-2 text-right">{currency.format(t.expenseTotal)}</td>
                <td className="px-4 py-2 text-right">{currency.format(t.netTotal)}</td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  Sin establecimientos activos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
