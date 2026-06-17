import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { ChurnView } from "@/components/dashboard/churn-view";

export type ChurnClient = {
  id: string;
  name: string;
  phone: string;
  petName: string;
  lastVisitDays: number;
  avgIntervalDays: number;
  overdueRatio: number;
  riskLevel: "high" | "medium" | "low";
  totalVisits: number;
};

type PageProps = {
  searchParams: Promise<{ tenant?: string }>;
};

export default async function ChurnPage({ searchParams }: PageProps) {
  const { tenant } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  const res = await fetch(apiUrl("/api/dashboard/metrics/churn"), {
    cache: "no-store",
    headers,
  });

  const clients: ChurnClient[] = res.ok ? await res.json() : [];

  const high = clients.filter((c) => c.riskLevel === "high");
  const medium = clients.filter((c) => c.riskLevel === "medium");
  const low = clients.filter((c) => c.riskLevel === "low");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Predicción de Churn</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clientes en riesgo de abandono basado en su frecuencia histórica de visitas.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4 max-w-lg">
        <div className="rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 p-3 text-center">
          <div className="text-2xl font-bold text-red-700 dark:text-red-400">{high.length}</div>
          <div className="text-xs text-red-600 dark:text-red-500 mt-0.5">Riesgo alto</div>
        </div>
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 p-3 text-center">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{medium.length}</div>
          <div className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Riesgo medio</div>
        </div>
        <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{low.length}</div>
          <div className="text-xs text-yellow-600 dark:text-yellow-500 mt-0.5">Riesgo bajo</div>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No hay clientes en riesgo de churn todavía.
          <br />
          Se necesitan al menos 2 citas completadas por cliente para calcular el riesgo.
        </div>
      ) : (
        <ChurnView clients={clients} />
      )}
    </div>
  );
}
