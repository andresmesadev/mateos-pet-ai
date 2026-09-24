import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

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
    <div className="mx-auto max-w-[1500px] space-y-8 pb-10">
      <section aria-labelledby="pulse-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-teal-700">Resumen diario</p>
            <h2 id="pulse-heading" className="text-xl font-bold tracking-tight text-foreground md:text-2xl">El pulso de hoy</h2>
          </div>
          <Link href="/dashboard/calendar" className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
            <CalendarDays className="h-4 w-4" /> Abrir agenda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Suspense fallback={<MetricsSkeleton />}>
          <MetricsSection headers={headers} />
        </Suspense>
      </section>

      <QuickActions />

      <section aria-labelledby="operation-heading" className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold text-teal-700">En curso</p>
          <h2 id="operation-heading" className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Tu operación</h2>
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <Suspense fallback={<ListCardSkeleton titleWidth="w-32" />}>
            <TodaySection headers={headers} />
          </Suspense>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
            <Suspense fallback={<ListCardSkeleton titleWidth="w-40" />}>
              <ConversationsActiveSection headers={headers} />
            </Suspense>
            <Suspense fallback={<ListCardSkeleton titleWidth="w-44" />}>
              <RemindersSection headers={headers} />
            </Suspense>
          </div>
        </div>
      </section>

      <section aria-labelledby="followup-heading" className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold text-teal-700">Seguimiento</p>
          <h2 id="followup-heading" className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Lo que merece atención</h2>
        </div>
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Suspense fallback={<ListCardSkeleton rows={2} titleWidth="w-36" />}>
            <OpportunitiesWidget headers={headers} />
          </Suspense>
          <Suspense fallback={<ListCardSkeleton rows={2} titleWidth="w-36" />}>
            <ChurnWidget headers={headers} />
          </Suspense>
          <Suspense fallback={<ListCardSkeleton rows={2} titleWidth="w-36" />}>
            <ReactivarWidget headers={headers} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
