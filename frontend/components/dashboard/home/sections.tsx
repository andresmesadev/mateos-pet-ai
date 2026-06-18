import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyMetricsCards } from "@/components/dashboard/daily-metrics-cards";
import { RecoveryCard } from "@/components/dashboard/recovery-card";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { formatService } from "@/lib/appointments";
import { formatPhone, formatRelativeTime } from "@/lib/conversations";
import { getPetEmoji } from "@/lib/pets";
import {
  type UpcomingReminder,
  fetchToday,
  fetchInactiveCount,
  fetchDailyMetrics,
  fetchUpcomingReminders,
  fetchActiveConversations,
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

// ── Métricas diarias (5 cards) ────────────────────────────────
export async function MetricsSection({ headers }: { headers: Headers }) {
  const metrics = await fetchDailyMetrics(headers);
  return <DailyMetricsCards metrics={metrics} />;
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

// ── Encabezado de panel con enlace "Ver todas" ────────────────
function PanelHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
      <CardTitle className="text-base">{title}</CardTitle>
      <Link
        href={href}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </CardHeader>
  );
}

// ── Conversaciones activas ────────────────────────────────────
export async function ConversationsActiveSection({ headers }: { headers: Headers }) {
  const conversations = await fetchActiveConversations(headers);
  return (
    <Card className="h-full">
      <PanelHeader title="Conversaciones activas" href="/dashboard/conversations" linkLabel="Ver todas" />
      <CardContent className="p-0">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Las conversaciones de WhatsApp aparecerán aquí.
          </div>
        ) : (
          <ul className="divide-y">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/conversations?conversation=${c.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <MessageCircle className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {formatPhone(c.phone)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(c.lastMessageAt)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.lastMessage ?? "Sin mensajes"}
                    </p>
                  </div>
                  {c.requires_human_attention && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" title="Requiere atención" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Recordatorios próximos ────────────────────────────────────
const REMINDER_LABELS: Record<string, string> = {
  control: "Control",
  vaccine: "Vacuna",
  grooming: "Baño programado",
  exam: "Examen",
  treatment: "Tratamiento",
  other: "Recordatorio",
};

function reminderRelative(dueAt: string): { label: string; tone: string } {
  const due = new Date(dueAt);
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000);
  if (days < 0) return { label: "Vencido", tone: "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300" };
  if (days === 0) return { label: "Hoy", tone: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" };
  if (days === 1) return { label: "Mañana", tone: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" };
  return { label: `En ${days} días`, tone: "border-border bg-muted text-muted-foreground" };
}

function reminderDate(dueAt: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
  }).format(new Date(dueAt));
}

export async function RemindersSection({ headers }: { headers: Headers }) {
  const reminders: UpcomingReminder[] = await fetchUpcomingReminders(headers);
  return (
    <Card className="h-full">
      <PanelHeader title="Recordatorios próximos" href="/dashboard/recuperacion" linkLabel="Ver todos" />
      <CardContent className="p-0">
        {reminders.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay recordatorios pendientes.
          </div>
        ) : (
          <ul className="divide-y">
            {reminders.map((r) => {
              const rel = reminderRelative(r.dueAt);
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-base">
                    {getPetEmoji(r.petType ?? "other")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {REMINDER_LABELS[r.type] ?? formatService(r.type)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{r.petName}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">{reminderDate(r.dueAt)}</span>
                    <Badge variant="outline" className={rel.tone}>{rel.label}</Badge>
                  </div>
                </li>
              );
            })}
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
