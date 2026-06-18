import { Suspense } from "react";

import { auth } from "@/auth";
import { EscalationsPanel } from "@/components/dashboard/escalations-panel";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { makeServerHeaders } from "@/lib/api";
import {
  MetricsSection,
  TodaySection,
  OpportunitiesWidget,
  RecoverySection,
  UpcomingSection,
  ChurnWidget,
  ReactivarWidget,
} from "@/components/dashboard/home/sections";
import {
  MetricsSkeleton,
  ListCardSkeleton,
  CardSkeleton,
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
      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsSection headers={headers} />
      </Suspense>

      {/* Agenda (ancha) + próximas citas (lateral) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<ListCardSkeleton titleWidth="w-32" />}>
            <TodaySection headers={headers} />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<ListCardSkeleton titleWidth="w-40" />}>
            <UpcomingSection headers={headers} />
          </Suspense>
        </div>
      </div>

      <EscalationsPanel />

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

      <Suspense fallback={<CardSkeleton />}>
        <RecoverySection headers={headers} />
      </Suspense>

      <QuickActions />
    </div>
  );
}
