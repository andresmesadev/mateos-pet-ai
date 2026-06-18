import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { RecuperacionView } from "@/components/dashboard/recuperacion-view";
import { type OpportunitiesData } from "@/app/dashboard/opportunities/page";
import { type ChurnClient } from "@/app/dashboard/churn/page";

type InactiveClient = {
  id: string;
  phone: string;
  name: string | null;
  pets: { name: string; type: string }[];
  lastAppointmentDate: string | null;
};

export type RecuperacionData = {
  opportunities: OpportunitiesData;
  inactive: InactiveClient[];
  churn: ChurnClient[];
};

type PageProps = {
  searchParams: Promise<{ tenant?: string; tab?: string }>;
};

export default async function RecuperacionPage({ searchParams }: PageProps) {
  const { tenant, tab } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  const [opportunitiesRes, inactiveRes, churnRes] = await Promise.all([
    fetch(apiUrl("/api/dashboard/opportunities"), { cache: "no-store", headers }),
    fetch(apiUrl("/api/dashboard/clients/inactive"), { cache: "no-store", headers }),
    fetch(apiUrl("/api/dashboard/metrics/churn"), { cache: "no-store", headers }),
  ]);

  const data: RecuperacionData = {
    opportunities: opportunitiesRes.ok
      ? await opportunitiesRes.json()
      : { byType: {}, inactive: [] },
    inactive: inactiveRes.ok ? await inactiveRes.json() : [],
    churn: churnRes.ok ? await churnRes.json() : [],
  };

  // Contadores para los tabs
  const oppCount = Object.values(data.opportunities.byType).flat().length;
  const inactiveCount = data.inactive.length;
  const churnHighCount = data.churn.filter((c) => c.riskLevel === "high").length;
  const churnCount = data.churn.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recuperación de clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acciones pendientes, reactivación de clientes inactivos y predicción de churn.
        </p>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-4 max-w-lg">
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 p-3 text-center">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{oppCount}</div>
          <div className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">Acciones pendientes</div>
        </div>
        <div className="rounded-lg border bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900 p-3 text-center">
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{inactiveCount}</div>
          <div className="text-xs text-orange-600 dark:text-orange-500 mt-0.5">Clientes inactivos</div>
        </div>
        <div className="rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 p-3 text-center">
          <div className="text-2xl font-bold text-red-700 dark:text-red-400">{churnHighCount}</div>
          <div className="text-xs text-red-600 dark:text-red-500 mt-0.5">Churn riesgo alto</div>
        </div>
      </div>

      <RecuperacionView
        data={data}
        initialTab={(tab as "oportunidades" | "reactivar" | "churn") ?? "oportunidades"}
        oppCount={oppCount}
        inactiveCount={inactiveCount}
        churnCount={churnCount}
      />
    </div>
  );
}
