import { redirect } from "next/navigation";
export default async function ReactivationPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const { tenant } = await searchParams;
  redirect(`/dashboard/recuperacion?tab=reactivar${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`);
}
