import { CreditCard } from "lucide-react";

import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyBillingAdministrator, billingTenantId } from "@/lib/billing-access";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { BillingView } from "@/components/dashboard/billing-view";

export type BillingStatus = {
  id: string;
  name: string;
  plan: string;
  active: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  planExpiresAt: string | null;
};

type PageProps = {
  searchParams: Promise<{ tenant?: string; success?: string; canceled?: string }>;
};

export default async function BillingPage({ searchParams }: PageProps) {
  const { tenant, success, canceled } = await searchParams;
  const session = await auth();
  const authorization = await verifyBillingAdministrator(session);
  if (!authorization.allowed) redirect(authorization.reason === "role" ? "/dashboard" : `/session-recovery?reason=${authorization.reason}`);
  const tenantId = billingTenantId(session, tenant);
  if (!tenantId) return <p role="status">Selecciona un establecimiento para gestionar su suscripción.</p>;
  const headers = makeServerHeaders(session, tenantId);
  const billingPath = session?.user?.isSuperAdmin ? `/dashboard/billing?tenant=${encodeURIComponent(tenantId)}` : "/dashboard/billing";

  const res = await fetch(apiUrl(`/api/billing/status/${tenantId}`), {
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  const status: BillingStatus | null = res?.ok ? await res.json().catch(() => null) : null;
  if (!status) return <div role="alert">No se pudo consultar la suscripción. <Link href={billingPath}>Volver a consultar</Link></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan y facturación"
        description="Gestiona tu suscripción a Huella Nex"
        icon={CreditCard}
        tint="bg-teal-500/15 text-teal-700"
      />

      {!status.active && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">El negocio está suspendido. Puedes gestionar su suscripción; la operación se habilitará cuando se confirme un estado activo.</p>}
      {status.active && <Link href={session?.user?.isSuperAdmin ? `/dashboard?tenant=${encodeURIComponent(tenantId)}` : "/dashboard"} className="text-sm underline">Volver al panel</Link>}
      {success === "1" && status.active && ["active", "trialing"].includes(status.subscriptionStatus ?? "") && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3 text-sm text-green-800 dark:text-green-300">
          El proveedor confirmó una suscripción habilitada.
        </div>
      )}
      {canceled === "1" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          El proceso de pago fue cancelado. Puedes intentarlo de nuevo cuando quieras.
        </div>
      )}

      {success === "1" && !status.active && <p role="status">Estamos pendientes de la confirmación del proveedor. <Link href={billingPath}>Consultar estado</Link></p>}

      <BillingView status={status} />
    </div>
  );
}
