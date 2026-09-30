import { connection } from "next/server";
import { Scissors } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { GroomingView } from "@/components/dashboard/grooming-view";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { type GroomingVisit } from "@/lib/grooming";

export default async function PeluqueriaPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  await connection();
  const { tenant } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);
  let visits: GroomingVisit[] = [];
  let hasMore = false;
  let groomingEnabled: boolean | null = null;
  let error: string | null = null;
  try {
    const [visitsResponse, profileResponse] = await Promise.all([
      fetch(apiUrl("/api/dashboard/grooming/appointments"), { headers, cache: "no-store" }),
      fetch(apiUrl("/api/dashboard/tenant/profile"), { headers, cache: "no-store" }),
    ]);
    const payload = await visitsResponse.json() as { appointments?: GroomingVisit[]; hasMore?: boolean; error?: string };
    if (visitsResponse.ok && Array.isArray(payload.appointments)) {
      visits = payload.appointments;
      hasMore = Boolean(payload.hasMore);
    } else error = payload.error ?? "No se pudieron cargar las citas de peluquería.";
    if (profileResponse.ok) {
      const profile = await profileResponse.json() as { activeModules?: string[] };
      if (Array.isArray(profile.activeModules)) groomingEnabled = profile.activeModules.includes("grooming");
    }
  } catch { error = "El servidor de datos no está disponible. Intenta de nuevo para ver las citas de peluquería."; }

  return <div className="mx-auto max-w-[1500px] pb-10">
    <PageHeader title="Peluquería" description="Baños, cortes y cuidados de cada mascota." icon={Scissors} tint="bg-amber-100 text-amber-800" />
    {groomingEnabled === false ? <div className="rounded-2xl border bg-white p-7"><h2 className="font-semibold">El módulo de peluquería no está activo</h2><p className="mt-2 text-sm text-muted-foreground">Esta sección se habilita en establecimientos que prestan servicios de baño o corte.</p></div> : <GroomingView initialVisits={visits} initialHasMore={hasMore} initialError={error} tenantId={tenant} />}
  </div>;
}
