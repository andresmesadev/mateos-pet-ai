import Link from "next/link";
import { AlertTriangle, ArrowRight, MessageCircle, Pin, RotateCcw } from "lucide-react";

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
  const hasOverdue = actionsSummary.overduePets > 0;
  const isEmpty = actionsSummary.total === 0;

  return (
    <Link href="/dashboard/recuperacion?tab=oportunidades" className="block h-full">
      <Card className={`group h-full transition-all duration-200 hover:-translate-y-0.5 ${
        isEmpty
          ? "border border-border hover:border-border/80"
          : hasOverdue
            ? "border border-amber-500/25 bg-amber-500/5 hover:border-amber-500/40"
            : "border border-sky-500/20 bg-sky-500/5 hover:border-sky-500/35"
      }`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Pin className={`h-4 w-4 shrink-0 ${isEmpty ? "text-muted-foreground" : hasOverdue ? "text-amber-400" : "text-sky-400"}`} />
            Recordatorios pendientes
            {!isEmpty && (
              <Badge className={hasOverdue
                ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                : "border-sky-500/30 bg-sky-500/15 text-sky-300"
              }>
                {actionsSummary.total}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <p className="text-sm text-muted-foreground">No hay recordatorios pendientes.</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {Object.entries(actionsSummary.byType).map(([type, count]) => (
                <span key={type}>{count} {TYPE_LABELS[type] ?? type}</span>
              ))}
            </div>
          )}
          <p className={`mt-2 flex items-center gap-1.5 text-xs ${hasOverdue && !isEmpty ? "font-medium text-amber-400" : "text-muted-foreground"}`}>
            {hasOverdue && !isEmpty && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
            {hasOverdue && !isEmpty
              ? `${actionsSummary.overduePets} mascota${actionsSummary.overduePets === 1 ? "" : "s"} con acción vencida`
              : "Ver recordatorios"}
            <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-50" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Encabezado de panel con enlace "Ver todas" ────────────────
function PanelHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <CardHeader className="flex flex-row items-center justify-between border-b border-white/[0.12] pb-3">
      <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
      <Link
        href={href}
        className="flex items-center gap-1 text-xs font-medium text-primary/70 transition-colors hover:text-primary"
      >
        {linkLabel}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </CardHeader>
  );
}

// ── Conversaciones activas ────────────────────────────────────
export async function ConversationsActiveSection({ headers }: { headers: Headers }) {
  const conversations = await fetchActiveConversations(headers);
  return (
    <Card className="h-full border-t-2 border-t-emerald-500/50 border-white/[0.12]">
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
    <Card className="h-full border-t-2 border-t-amber-500/50 border-white/[0.12]">
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
  const churnHigh = churnAtRisk.filter((c) => c.riskLevel === "high").length;
  const isEmpty = churnAtRisk.length === 0;

  return (
    <Link href="/dashboard/recuperacion?tab=churn" className="block h-full">
      <Card className={`group h-full transition-all duration-200 hover:-translate-y-0.5 ${
        isEmpty
          ? "border border-border hover:border-border/80"
          : "border border-red-500/25 bg-red-500/5 hover:border-red-500/40"
      }`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className={`h-4 w-4 shrink-0 ${isEmpty ? "text-muted-foreground" : "text-red-400"}`} />
            Riesgo de abandono
            {!isEmpty && (
              <Badge className="border-red-500/30 bg-red-500/15 text-red-300">
                {churnAtRisk.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <p className="text-sm text-muted-foreground">No hay clientes en riesgo.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {churnAtRisk.length} cliente{churnAtRisk.length === 1 ? "" : "s"} sin visitar en más tiempo del habitual.
            </p>
          )}
          <p className={`mt-2 flex items-center gap-1.5 text-xs ${churnHigh > 0 ? "font-medium text-red-400" : "text-muted-foreground"}`}>
            {churnHigh > 0 && <span className="inline-block h-2 w-2 rounded-full bg-red-400" />}
            {churnHigh > 0 ? `${churnHigh} en riesgo alto` : "Ver análisis de churn"}
            <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-50" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Widget de reactivación ────────────────────────────────────
export async function ReactivarWidget({ headers }: { headers: Headers }) {
  const inactiveCount = await fetchInactiveCount(headers);
  const isEmpty = inactiveCount === 0;

  return (
    <Link href="/dashboard/recuperacion?tab=reactivar" className="block h-full">
      <Card className={`group h-full transition-all duration-200 hover:-translate-y-0.5 ${
        isEmpty
          ? "border border-border hover:border-border/80"
          : "border border-orange-500/20 bg-orange-500/5 hover:border-orange-500/35"
      }`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <RotateCcw className={`h-4 w-4 shrink-0 ${isEmpty ? "text-muted-foreground" : "text-orange-400"}`} />
            Clientes a reactivar
            {!isEmpty && (
              <Badge className="border-orange-500/30 bg-orange-500/15 text-orange-300">
                {inactiveCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <p className="text-sm text-muted-foreground">No hay clientes inactivos.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {inactiveCount.toLocaleString()} cliente{inactiveCount === 1 ? "" : "s"} de peluquería sin visita en más de 60 días.
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            {!isEmpty && <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />}
            {isEmpty ? "Ver reactivación" : "Enviar campaña de reactivación"}
            <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-50" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
