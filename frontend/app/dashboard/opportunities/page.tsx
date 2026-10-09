import { redirect } from "next/navigation";
import { canonicalDashboardHref, type DashboardSearchParams } from "@/lib/dashboard-navigation";
export type { OpportunitiesData } from "@/lib/customer-followup";
export default async function Page({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  redirect(canonicalDashboardHref("/dashboard/recuperacion", await searchParams, { tab: "oportunidades" }));
}
