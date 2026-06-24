import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ period?: string; tenant?: string }>;
};

export default async function RevenuePage({ searchParams }: PageProps) {
  const { period, tenant } = await searchParams;
  const params = new URLSearchParams({ tab: "historial" });
  if (period) params.set("period", period);
  if (tenant) params.set("tenant", tenant);
  redirect(`/dashboard/pos?${params.toString()}`);
}
