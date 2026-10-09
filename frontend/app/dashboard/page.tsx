import { Suspense } from "react";
import { ROLE_NAMES } from "@/lib/dashboard-access";
import { HomeWorkspace } from "@/components/dashboard/home/workspace";

import { getDashboardAccess } from "@/lib/dashboard-access-server";
import { auth } from "@/auth";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { makeServerHeaders } from "@/lib/api";
import {
  ListCardSkeleton,
} from "@/components/dashboard/home/skeletons";

type DashboardPageProps = {
  searchParams: Promise<{ tenant?: string; review?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { tenant, review } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);
  const access = await getDashboardAccess(tenant);
  const now = new Date();
  const date = now.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const dateLabel = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" }).format(now);

  // Cada sección hace su propio fetch dentro de su Suspense boundary, así
  // se streamea de forma independiente: la página aparece de inmediato con
  // skeletons que reservan el espacio, y cada bloque se rellena al estar listo.
  return (
    <div className="mx-auto max-w-[1500px] space-y-8 pb-10">
      <section aria-labelledby="daily-overview-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-primary">Inicio · {ROLE_NAMES[access.role]}</p>
            <h2 id="daily-overview-heading" className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Tu jornada de hoy</h2>
            <p className="mt-1 text-sm capitalize text-muted-foreground">{dateLabel} · Hora de Colombia</p>
          </div>
        </div>
      </section>

      <QuickActions tenant={tenant} access={access} />

      <Suspense fallback={<ListCardSkeleton titleWidth="w-40" />}>
        <HomeWorkspace access={access} headers={headers} tenant={tenant} date={date} review={review === "1"} />
      </Suspense>

    </div>
  );
}
