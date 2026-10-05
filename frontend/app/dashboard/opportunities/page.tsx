import { redirect } from "next/navigation";
export type { OpportunitiesData } from "@/lib/customer-followup";
export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const { tenant } = await searchParams;
  redirect(`/dashboard/recuperacion?tab=oportunidades${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`);
}
