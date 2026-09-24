import { HeartPulse, Pin, UserX, AlertTriangle } from "lucide-react";

import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { RecuperacionView } from "@/components/dashboard/recuperacion-view";
import { type OpportunitiesData } from "@/app/dashboard/opportunities/page";
import { type ChurnClient } from "@/app/dashboard/churn/page";

type InactiveClient = {
  id: string;
  phone: string;
  name: string | null;
  pets: { name: string; type: string }[];
  lastVisitDate: string | null;
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

  const pageHeader = (
    <PageHeader
      title="Recuperación de clientes"
      description="Acciones pendientes, reactivación de inactivos y riesgo de abandono"
      icon={HeartPulse}
      tint="bg-rose-100 text-rose-700"
    />
  );

  let data: RecuperacionData | null = null;
  try {
    const [opportunitiesRes, inactiveRes, churnRes] = await Promise.all([
      fetch(apiUrl("/api/dashboard/opportunities"), { cache: "no-store", headers }),
      fetch(apiUrl("/api/dashboard/clients/inactive"), { cache: "no-store", headers }),
      fetch(apiUrl("/api/dashboard/metrics/churn"), { cache: "no-store", headers }),
    ]);
    if (opportunitiesRes.ok && inactiveRes.ok && churnRes.ok) {
      data = {
        opportunities: await opportunitiesRes.json(),
        inactive: await inactiveRes.json(),
        churn: await churnRes.json(),
      };
    }
  } catch {
    // La interfaz muestra un estado de error sin confundir la falta de conexión con cero resultados.
  }

  if (!data) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
          <h2 className="font-semibold">No se pudo cargar la recuperación</h2>
          <p className="mt-1">El servidor de datos no está disponible. Actualiza la página para intentarlo de nuevo.</p>
        </div>
      </div>
    );
  }

  // Contadores para los tabs
  const oppCount = data.opportunities.total ?? Object.values(data.opportunities.byType).flat().length;
  const inactiveCount = data.inactive.length;
  const churnHighCount = data.churn.filter((c) => c.riskLevel === "high").length;
  const churnCount = data.churn.length;

  return (
    <div className="space-y-6">
      {pageHeader}


      {/* Resumen rápido */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-2xl">
        <div className="rounded-xl border-t-2 border-t-blue-500/70 border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Acciones pendientes</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
              <Pin className="h-4 w-4 text-blue-700" />
            </div>
          </div>
          <p className="text-4xl font-bold tabular-nums text-blue-800">{oppCount}</p>
          <p className="mt-1 text-xs text-blue-500">Recordatorios de mascotas</p>
        </div>
        <div className="rounded-xl border-t-2 border-t-orange-500/70 border border-orange-500/20 bg-orange-500/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-orange-700 uppercase tracking-wide">Clientes inactivos</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15">
              <UserX className="h-4 w-4 text-orange-700" />
            </div>
          </div>
          <p className="text-4xl font-bold tabular-nums text-orange-800">{inactiveCount}</p>
          <p className="mt-1 text-xs text-orange-500">Sin grooming en +60 días</p>
        </div>
        <div className="rounded-xl border-t-2 border-t-red-500/70 border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Churn riesgo alto</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15">
              <AlertTriangle className="h-4 w-4 text-red-700" />
            </div>
          </div>
          <p className="text-4xl font-bold tabular-nums text-red-800">{churnHighCount}</p>
          <p className="mt-1 text-xs text-red-500">De {churnCount} en riesgo total</p>
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
