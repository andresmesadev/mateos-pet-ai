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
      <Card className={`group h-full glass-card transition-all duration-200 hover:-translate-y-0.5 ${
        isEmpty
          ? "border border-white/[0.08] hover:border-white/[0.12]"
          : hasOverdue
            ? "border border-white/[0.08] border-t-2 border-t-amber-500/50 bg-amber-500/[0.04] hover:border-amber-500/30 hover:shadow-[0_0_24px_rgba(245,158,11,0.12)]"
            : "border border-white/[0.08] border-t-2 border-t-sky-500/50 bg-sky-500/[0.04] hover:border-sky-500/30 hover:shadow-[0_0_24px_rgba(14,165,233,0.12)]"
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

// ── SVG ilustración mascota + IA ──────────────────────────────
function PetAiIllustration() {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-24 w-24 text-primary/60"
      aria-hidden="true"
    >
      {/* Cuerpo */}
      <ellipse cx="48" cy="62" rx="22" ry="17" stroke="currentColor" strokeWidth="1.5" />
      {/* Cabeza */}
      <circle cx="48" cy="34" r="16" stroke="currentColor" strokeWidth="1.5" />
      {/* Orejas */}
      <path d="M34 24 C29 14 21 16 23 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M62 24 C67 14 75 16 73 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Ojos */}
      <circle cx="42" cy="32" r="2.5" fill="currentColor" />
      <circle cx="54" cy="32" r="2.5" fill="currentColor" />
      {/* Brillo en ojos */}
      <circle cx="43" cy="31" r="0.8" fill="white" opacity="0.7" />
      <circle cx="55" cy="31" r="0.8" fill="white" opacity="0.7" />
      {/* Nariz */}
      <ellipse cx="48" cy="38.5" rx="3" ry="2" fill="currentColor" opacity="0.5" />
      {/* Circuitos — derecha */}
      <path d="M76 18 L84 18 L84 30 L80 30" stroke="currentColor" strokeWidth="0.8" opacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="80" cy="30" r="1.5" fill="currentColor" opacity="0.4" />
      <circle cx="84" cy="18" r="1.5" fill="currentColor" opacity="0.35" />
      {/* Circuitos — izquierda */}
      <path d="M20 22 L12 22 L12 36 L16 36" stroke="currentColor" strokeWidth="0.8" opacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="36" r="1.5" fill="currentColor" opacity="0.4" />
      {/* Sparkles */}
      <path d="M10 60 L10 65 M7.5 62.5 L12.5 62.5" stroke="currentColor" strokeWidth="1.2" opacity="0.45" strokeLinecap="round" />
      <path d="M82 56 L82 60 M80 58 L84 58" stroke="currentColor" strokeWidth="1.2" opacity="0.45" strokeLinecap="round" />
      <path d="M86 30 L87 32.5 M84.5 31 L87.5 31" stroke="currentColor" strokeWidth="0.9" opacity="0.35" strokeLinecap="round" />
      <path d="M8 42 L9 44" stroke="currentColor" strokeWidth="0.9" opacity="0.3" strokeLinecap="round" />
    </svg>
  );
}

// ── Conversaciones activas ────────────────────────────────────
export async function ConversationsActiveSection({ headers }: { headers: Headers }) {
  const conversations = await fetchActiveConversations(headers);
  return (
    <Card className="h-full border-t-2 border-t-emerald-500/50 border-white/[0.10] glass-card bg-emerald-500/[0.03]">
      <PanelHeader title="Conversaciones activas" href="/dashboard/conversations" linkLabel="Ver todas" />
      <CardContent className="p-0">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <PetAiIllustration />
            <p className="text-sm text-muted-foreground">Las conversaciones de WhatsApp aparecerán aquí.</p>
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
    <Card className="h-full border-t-2 border-t-amber-500/50 border-white/[0.10] glass-card bg-amber-500/[0.03]">
      <PanelHeader title="Recordatorios próximos" href="/dashboard/recuperacion" linkLabel="Ver todos" />
      <CardContent className="p-0">
        {reminders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <PetAiIllustration />
            <p className="text-sm text-muted-foreground">No hay recordatorios pendientes.</p>
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
      <Card className={`group h-full glass-card transition-all duration-200 hover:-translate-y-0.5 ${
        isEmpty
          ? "border border-white/[0.08] hover:border-white/[0.12]"
          : "border border-white/[0.08] border-t-2 border-t-rose-500/50 bg-rose-500/[0.04] hover:border-rose-500/30 hover:shadow-[0_0_24px_rgba(244,63,94,0.12)]"
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
      <Card className={`group h-full glass-card transition-all duration-200 hover:-translate-y-0.5 ${
        isEmpty
          ? "border border-white/[0.08] hover:border-white/[0.12]"
          : "border border-white/[0.08] border-t-2 border-t-orange-500/50 bg-orange-500/[0.04] hover:border-orange-500/30 hover:shadow-[0_0_24px_rgba(249,115,22,0.12)]"
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
