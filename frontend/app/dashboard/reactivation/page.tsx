import { redirect } from "next/navigation";
import { canonicalDashboardHref, type DashboardSearchParams } from "@/lib/dashboard-navigation";
export default async function Page({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  redirect(canonicalDashboardHref("/dashboard/recuperacion", await searchParams, { tab: "reactivar" }));
}
