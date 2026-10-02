import Link from "next/link";
import { ArrowRight, MessageCircle, Pin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyMetricsCards } from "@/components/dashboard/daily-metrics-cards";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { formatService } from "@/lib/appointments";
import { formatPhone, formatRelativeTime } from "@/lib/conversations";
import { getPetEmoji } from "@/lib/pets";
import {
  fetchToday,
  fetchDailyMetrics,
  fetchUpcomingReminders,
  fetchActiveConversations,
  fetchEscalatedConversations,
  fetchActionsSummary,
} from "@/components/dashboard/home/fetchers";

type Headers = Record<string, string>;

function DataUnavailable({ title, className = "" }: { title: string; className?: string }) {
  return (
    <Card className={`h-full border-border bg-white ${className}`}>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">No se pudieron cargar los datos. Actualiza la página para intentarlo de nuevo.</p>
      </CardContent>
    </Card>
  );
}
// ── Operación y resultado del administrador ───────────────────
export async function MetricsSection({ headers, tenant, agenda = true }: { headers: Headers; tenant?: string; agenda?: boolean }) {
  const [metrics, appointments] = await Promise.all([fetchDailyMetrics(headers), agenda ? fetchToday(headers) : Promise.resolve(null)]);
  if (!metrics && !appointments) return <DataUnavailable title="Indicadores no disponibles" />;
  return <DailyMetricsCards metrics={metrics} appointments={appointments} tenant={tenant} />;
}

// ── Agenda de hoy ─────────────────────────────────────────────
export async function TodaySection({ headers, review }: { headers: Headers; review?: boolean }) {
  const today = await fetchToday(headers);
  if (!today) return <DataUnavailable title="Agenda de hoy" />;
  return <TodaySchedule key={review ? "review" : "all"} appointments={today} initialReview={review} />;
}

// ── Encabezado de panel con enlace "Ver todas" ────────────────
function PanelHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
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
  const [conversations, escalations] = await Promise.all([fetchActiveConversations(headers), fetchEscalatedConversations(headers)]);
  if (!conversations) return <DataUnavailable title="Conversaciones activas" />;
  const humanAttention = escalations?.length ?? 0;
  return (
    <Card className="h-full border-t-2 border-t-emerald-500/50 border-black/[0.10] glass-card bg-emerald-500/[0.03]">
      <PanelHeader title="Conversaciones activas" href="/dashboard/conversations" linkLabel="Ver todas" />
      <CardContent className="p-0">
        {humanAttention > 0 && <Link href={humanAttention === 1 ? `/dashboard/conversations?conversation=${encodeURIComponent(escalations![0].id)}` : "/dashboard/conversations"} className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 hover:bg-amber-100">
          <span>{humanAttention === 1 ? "Hay una conversación esperando respuesta" : `${humanAttention} conversaciones esperan respuesta`}</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>}
        {conversations.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><MessageCircle className="h-4 w-4" aria-hidden="true" /></span>
            <p className="text-sm text-muted-foreground">{humanAttention > 0 ? "Abre la bandeja para responder las conversaciones pendientes." : "No hay conversaciones recientes. Las nuevas aparecerán aquí."}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/conversations?conversation=${c.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
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
// ── Seguimientos pendientes y próximos ────────────────────────
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
  const bogotaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" });
  const startOfDay = (d: Date) => Date.parse(`${bogotaDay.format(d)}T00:00:00Z`);
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
  const [reminders, summary] = await Promise.all([fetchUpcomingReminders(headers), fetchActionsSummary(headers)]);
  if (!reminders) return <DataUnavailable title="Seguimientos" />;
  const overduePets = summary?.overduePets ?? 0;
  return (
    <Card className="h-full border-t-2 border-t-amber-500/50 border-black/[0.10] glass-card bg-amber-500/[0.03]">
      <PanelHeader title="Seguimientos" href="/dashboard/recuperacion?tab=oportunidades" linkLabel="Ver todos" />
      <CardContent className="p-0">
        {overduePets > 0 && <Link href="/dashboard/recuperacion?tab=oportunidades" className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 hover:bg-amber-100">
          <span>Revisar {overduePets} {overduePets === 1 ? "mascota con seguimiento vencido" : "mascotas con seguimiento vencido"}</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>}
        {reminders.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800"><Pin className="h-4 w-4" aria-hidden="true" /></span>
            <p className="text-sm text-muted-foreground">{overduePets > 0 ? "Abre el seguimiento para revisar los vencidos." : "No hay seguimientos pendientes."}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {reminders.map((r) => {
              const rel = reminderRelative(r.dueAt);
              return (
                <li key={r.id}>
                  <Link href={`/dashboard/contacto?pet=${encodeURIComponent(r.petId)}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-amber-700" aria-label={`Abrir seguimiento de ${r.petName}: ${REMINDER_LABELS[r.type] ?? formatService(r.type)}`}>
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
                  <ArrowRight className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
