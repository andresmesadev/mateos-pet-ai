import { CreditCard } from "lucide-react";

import { auth } from "@/auth";
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
  const headers = makeServerHeaders(session, tenant);

  const res = await fetch(apiUrl(`/api/billing/status/${session?.user?.tenantId ?? "none"}`), {
    cache: "no-store",
    headers,
  });

  const status: BillingStatus | null = res.ok ? await res.json() : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan y facturación"
        description="Gestiona tu suscripción a Mateos Pet AI"
        icon={CreditCard}
        tint="bg-teal-500/15 text-teal-400"
      />

      {success === "1" && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3 text-sm text-green-800 dark:text-green-300">
          ✅ ¡Pago exitoso! Tu plan ha sido activado. Puede tomar unos segundos en reflejarse.
        </div>
      )}
      {canceled === "1" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          El proceso de pago fue cancelado. Puedes intentarlo de nuevo cuando quieras.
        </div>
      )}

      <BillingView status={status} />
    </div>
  );
}
