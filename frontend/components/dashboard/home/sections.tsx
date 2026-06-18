import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { RecoveryCard } from "@/components/dashboard/recovery-card";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import {
  formatColombiaDateTime,
  formatService,
  formatStatus,
  statusBadgeClass,
} from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";
import {
  fetchToday,
  fetchUpcoming,
  fetchInactiveCount,
  fetchMetrics,
  fetchActionsSummary,
  fetchRecoveryMetrics,
  fetchChurnPreview,
} from "@/components/dashboard/home/fetchers";

type Headers = Record<string, string>;

const TYPE_LABELS: Record<string, string> = {
  control: "controles",
  vaccine: "vacunas",
  grooming: "grooming",
  exam: "exámenes",
  treatment: "tratamientos",
  other: "otros",
};

// ── Métricas ──────────────────────────────────────────────────
export async function MetricsSection({ headers }: { headers: Headers }) {
  const metrics = await fetchMetrics(headers);
  return <MetricsCards metrics={metrics} />;
}

// ── Agenda de hoy ─────────────────────────────────────────────
export async function TodaySection({ headers }: { headers: Headers }) {
  const today = await fetchToday(headers);
  return <TodaySchedule appointments={today} />;
}

// ── Recuperación real ─────────────────────────────────────────
export async function RecoverySection({ headers }: { headers: Headers }) {
  const recovery = await fetchRecoveryMetrics(headers);
  return <RecoveryCard metrics={recovery} />;
}

// ── Bandeja de oportunidades (widget) ─────────────────────────
export async function OpportunitiesWidget({ headers }: { headers: Headers }) {
  const actionsSummary = await fetchActionsSummary(headers);
  if (actionsSummary.total === 0) return null;

  const hasOverdue = actionsSummary.overduePets > 0;
  return (
    <Link href="/dashboard/recuperacion?tab=oportunidades" className="block">
      <Card className={`transition-colors ${hasOverdue
        ? "border-2 border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/10"
        : "border-2 border-blue-200 bg-blue-50/40 hover:bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/10"
      }`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            📌 Mascotas con acciones pendientes
            <Badge className={hasOverdue
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
              <span key={type}>{count} {TYPE_LABELS[type] ?? type}</span>
            ))}
          </div>
          {hasOverdue ? (
            <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              ⚠️ {actionsSummary.overduePets} mascota{actionsSummary.overduePets === 1 ? "" : "s"} con acción vencida → Ver bandeja
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Ver bandeja de oportunidades →</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Próximas citas ────────────────────────────────────────────
export async function UpcomingSection({ headers }: { headers: Headers }) {
  const upcoming = await fetchUpcoming(headers);
  return (
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
                <Badge variant="outline" className={`shrink-0 ${statusBadgeClass(appt.status)}`}>
                  {formatStatus(appt.status)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Widget de churn ───────────────────────────────────────────
export async function ChurnWidget({ headers }: { headers: Headers }) {
  const churnAtRisk = await fetchChurnPreview(headers);
  if (churnAtRisk.length === 0) return null;

  const churnHigh = churnAtRisk.filter((c) => c.riskLevel === "high").length;
  return (
    <Link href="/dashboard/recuperacion?tab=churn" className="block">
      <Card className="border-2 border-red-200 bg-red-50/40 transition-colors hover:bg-red-50/70 dark:border-red-900 dark:bg-red-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            ⚠️ Clientes en riesgo de abandono
            <Badge className="border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {churnAtRisk.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {churnAtRisk.length} cliente{churnAtRisk.length === 1 ? "" : "s"} llevan más tiempo del habitual sin visitar.
            {churnHigh > 0 && ` ${churnHigh} en riesgo alto.`}
            {" "}Ver predicción de churn →
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Widget de reactivación ────────────────────────────────────
export async function ReactivarWidget({ headers }: { headers: Headers }) {
  const inactiveCount = await fetchInactiveCount(headers);
  if (inactiveCount === 0) return null;

  return (
    <Link href="/dashboard/recuperacion?tab=reactivar" className="block">
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
  );
}
