import { redirect } from "next/navigation";
export type { ChurnClient } from "@/lib/customer-followup";
export default async function ChurnPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const { tenant } = await searchParams;
  redirect(`/dashboard/recuperacion?tab=churn${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`);
}
