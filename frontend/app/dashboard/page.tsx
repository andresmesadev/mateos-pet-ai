import Link from "next/link";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EscalationsPanel } from "@/components/dashboard/escalations-panel";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import {
  type TodayAppointment,
  formatColombiaDateTime,
  formatService,
  formatStatus,
  statusBadgeClass,
} from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";

type UpcomingAppointment = TodayAppointment;

type MetricsData = {
  appointmentsThisWeek: { count: number; prev: number; delta: number };
  confirmationRate: { rate: number; prev: number; delta: number };
  newClientsThisMonth: { count: number; prev: number; delta: number };
};

type ActionsSummary = {
  total: number;
  byType: Record<string, number>;
  overduePets: number;
};

const METRICS_FALLBACK: MetricsData = {
  appointmentsThisWeek: { count: 0, prev: 0, delta: 0 },
  confirmationRate: { rate: 0, prev: 0, delta: 0 },
  newClientsThisMonth: { count: 0, prev: 0, delta: 0 },
};

const ACTIONS_FALLBACK: ActionsSummary = { total: 0, byType: {}, overduePets: 0 };

async function fetchToday(headers: Record<string, string>): Promise<TodayAppointment[]> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/appointments/today"), { cache: "no-store", headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function fetchUpcoming(headers: Record<string, string>): Promise<UpcomingAppointment[]> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/appointments/upcoming"), { cache: "no-store", headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function fetchInactiveCount(headers: Record<string, string>): Promise<number> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/clients/inactive-count"), { cache: "no-store", headers });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch { return 0; }
}

async function fetchMetrics(headers: Record<string, string>): Promise<MetricsData> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/metrics"), { cache: "no-store", headers });
    if (!res.ok) return METRICS_FALLBACK;
    return (await res.json()) as MetricsData;
  } catch { return METRICS_FALLBACK; }
}

async function fetchActionsSummary(headers: Record<string, string>): Promise<ActionsSummary> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/next-actions/summary"), { cache: "no-store", headers });
    if (!res.ok) return ACTIONS_FALLBACK;
    return (await res.json()) as ActionsSummary;
  } catch { return ACTIONS_FALLBACK; }
}

const TYPE_LABELS: Record<string, string> = {
  control: "controles",
  vaccine: "vacunas",
  grooming: "grooming",
  exam: "exámenes",
  treatment: "tratamientos",
  other: "otros",
};

type DashboardPageProps = {
  searchParams: Promise<{ tenant?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { tenant } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);
  const [today, upcoming, inactiveCount, metrics, actionsSummary] = await Promise.all([
    fetchToday(headers),
    fetchUpcoming(headers),
    fetchInactiveCount(headers),
    fetchMetrics(headers),
    fetchActionsSummary(headers),
  ]);

  return (
    <div className="space-y-8">
      {/* MÉTRICAS */}
      <MetricsCards metrics={metrics} />

      {/* HOY */}
      <TodaySchedule appointments={today} />

      {/* ALERTAS */}
      <EscalationsPanel />

      {/* BANDEJA DE OPORTUNIDADES — widget */}
      {actionsSummary.total > 0 && (
        <Link href="/dashboard/opportunities" className="block">
          <Card className={`transition-colors ${actionsSummary.overduePets > 0
            ? "border-2 border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/10"
            : "border-2 border-blue-200 bg-blue-50/40 hover:bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/10"
          }`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                📌 Mascotas con acciones pendientes
                <Badge className={actionsSummary.overduePets > 0
                  ? "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  : "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
                }>
                  {actionsSummary.total}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {Object.entries(actionsSummary.byType).map(([type, count]) => (
                  <span key={type}>
                    {count} {TYPE_LABELS[type] ?? type}
                  </span>
                ))}
              </div>
              {actionsSummary.overduePets > 0 && (
                <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  ⚠️ {actionsSummary.overduePets} mascota{actionsSummary.overduePets === 1 ? "" : "s"} con acción vencida → Ver bandeja
                </p>
              )}
              {actionsSummary.overduePets === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Ver bandeja de oportunidades →</p>
              )}
            </CardContent>
          </Card>
        </Link>
      )}

      {/* PRÓXIMAS CITAS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Próximas citas</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No hay citas programadas para los próximos 7 días.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {upcoming.map((appt) => (
                <li key={appt.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-base">{getPetEmoji(appt.petType)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{appt.petName}</span>
                    <span className="text-muted-foreground text-sm">
                      {" "}· {formatService(appt.serviceType)}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {formatColombiaDateTime(appt.date)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${statusBadgeClass(appt.status)}`}
                  >
                    {formatStatus(appt.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* REACTIVAR PREVIEW */}
      {inactiveCount > 0 && (
        <Link href="/dashboard/reactivation" className="block">
          <Card className="border-2 border-orange-200 bg-orange-50/50 transition-colors hover:bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/10 dark:hover:bg-orange-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                Clientes a reactivar
                <Badge className="border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300">
                  {inactiveCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {inactiveCount} cliente{inactiveCount === 1 ? "" : "s"} sin cita
                en más de 60 días. Envíales un WhatsApp para recuperarlos →
              </p>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
