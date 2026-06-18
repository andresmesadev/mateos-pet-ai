import { Suspense } from "react";

import { auth } from "@/auth";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { makeServerHeaders } from "@/lib/api";
import {
  MetricsSection,
  TodaySection,
  ConversationsActiveSection,
  RemindersSection,
  OpportunitiesWidget,
  ChurnWidget,
  ReactivarWidget,
} from "@/components/dashboard/home/sections";
import {
  MetricsSkeleton,
  ListCardSkeleton,
} from "@/components/dashboard/home/skeletons";

type DashboardPageProps = {
  searchParams: Promise<{ tenant?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { tenant } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  // Cada sección hace su propio fetch dentro de su Suspense boundary, así
  // se streamea de forma independiente: la página aparece de inmediato con
  // skeletons que reservan el espacio, y cada bloque se rellena al estar listo.
  return (
    <div className="space-y-6">
      {/* Fila superior: 5 métricas del día */}
      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsSection headers={headers} />
      </Suspense>

      {/* Tres paneles centrales */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Suspense fallback={<ListCardSkeleton titleWidth="w-32" />}>
          <TodaySection headers={headers} />
        </Suspense>
        <Suspense fallback={<ListCardSkeleton titleWidth="w-40" />}>
          <ConversationsActiveSection headers={headers} />
        </Suspense>
        <Suspense fallback={<ListCardSkeleton titleWidth="w-44" />}>
          <RemindersSection headers={headers} />
        </Suspense>
      </div>

      {/* Bandejas de oportunidad / riesgo */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={null}>
          <OpportunitiesWidget headers={headers} />
        </Suspense>
        <Suspense fallback={null}>
          <ChurnWidget headers={headers} />
        </Suspense>
        <Suspense fallback={null}>
          <ReactivarWidget headers={headers} />
        </Suspense>
      </div>

      <QuickActions />
    </div>
  );
}
