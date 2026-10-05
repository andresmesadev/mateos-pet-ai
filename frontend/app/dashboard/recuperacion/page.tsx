import { ClipboardList } from "lucide-react";
import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { getDashboardAccess } from "@/lib/dashboard-access-server";
import { PageHeader } from "@/components/dashboard/page-header";
import { RecuperacionView } from "@/components/dashboard/recuperacion-view";
import type { OpportunitiesData, InactiveClientsPage, ChurnClient, RecoveryMetrics } from "@/lib/customer-followup";

export type RecuperacionData = {
  opportunities: OpportunitiesData | null; inactive: InactiveClientsPage | null;
  churn: ChurnClient[] | null; metrics: RecoveryMetrics | null;
};
export default async function RecuperacionPage({ searchParams }: { searchParams: Promise<{ tenant?: string; tab?: string }> }) {
  const { tenant, tab } = await searchParams;
  const [session, access] = await Promise.all([auth(), getDashboardAccess(tenant)]);
  const grooming = access.activeModules.includes("grooming");
  const headers = makeServerHeaders(session, tenant);
  async function read<T>(path: string): Promise<T | null> {
    try { const res = await fetch(apiUrl(`/api/dashboard/${path}`), { cache: "no-store", headers }); return res.ok ? await res.json() : null; }
    catch { return null; }
  }
  const [opportunities, inactive, churn, metrics] = await Promise.all([
    read<OpportunitiesData>("opportunities"),
    grooming ? read<InactiveClientsPage>("clients/inactive?page=1") : Promise.resolve(null),
    grooming ? read<ChurnClient[]>("metrics/churn") : Promise.resolve(null),
    read<RecoveryMetrics>("metrics/recovery"),
  ]);
  return <div className="space-y-6">
    <PageHeader title="Seguimiento de clientes" description="Organiza los pendientes de las mascotas y da continuidad a sus visitas." icon={ClipboardList} tint="bg-teal-100 text-teal-700" />
    <RecuperacionView data={{ opportunities, inactive, churn, metrics }} grooming={grooming} initialTab={tab ?? "oportunidades"} />
  </div>;
}
