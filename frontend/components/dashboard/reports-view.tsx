"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  CalendarDays,
  Users,
  PawPrint,
  ChevronLeft,
  ChevronRight,
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  Syringe,
  Bug,
  Scissors,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type MetricPoint = { value: number; prev: number; delta: number; pct: number | null };

type Summary = {
  period: string;
  offset: number;
  rangeStart: string;
  rangeEnd: string;
  revenue: MetricPoint;
  appointments: MetricPoint;
  newClients: MetricPoint;
  petsAttended: MetricPoint;
};

type ServiceEntry = { name: string; count: number };

type RevenueMonth = { month: number; revenue: number };

type UpcomingReminder = {
  id: string;
  type: "vaccine" | "deworming" | "grooming";
  typeLabel: string;
  title: string;
  nextControlAt: string;
  petName: string;
  ownerName: string;
  ownerPhone: string;
};

type RetentionMonth = { label: string; newClients: number; returningVisits: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api/proxy/dashboard/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const up = pct > 0;
  const neutral = pct === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        neutral ? "text-muted-foreground" : up ? "text-emerald-400" : "text-red-400"
      )}
    >
      {neutral ? (
        <Minus className="h-3 w-3" />
      ) : up ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {Math.abs(pct)}% vs período anterior
    </span>
  );
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function RevenueBar({ months }: { months: RevenueMonth[] }) {
  const max = Math.max(...months.map((m) => m.revenue), 1);
  return (
    <div className="flex h-48 items-end gap-1.5">
      {months.map((m) => {
        const pct = (m.revenue / max) * 100;
        return (
          <div key={m.month} className="group flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm bg-emerald-500/60 transition-all duration-300 group-hover:bg-emerald-400"
              style={{ height: `${pct}%`, minHeight: pct > 0 ? 4 : 0 }}
              title={formatCOP(m.revenue)}
            />
            <span className="text-[10px] text-muted-foreground">{MONTH_NAMES[m.month - 1]}</span>
          </div>
        );
      })}
    </div>
  );
}

const REMINDER_ICONS = {
  vaccine: Syringe,
  deworming: Bug,
  grooming: Scissors,
};

const REMINDER_TINTS = {
  vaccine: "bg-blue-500/20 text-blue-400",
  deworming: "bg-orange-500/20 text-orange-400",
  grooming: "bg-purple-500/20 text-purple-400",
};

// ── Main component ─────────────────────────────────────────────────────────────

export function ReportsView() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [offset, setOffset] = useState(0);
  const [revenueYear, setRevenueYear] = useState(new Date().getFullYear());

  const [summary, setSummary] = useState<Summary | null>(null);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [revenueByMonth, setRevenueByMonth] = useState<RevenueMonth[]>([]);
  const [reminders, setReminders] = useState<UpcomingReminder[]>([]);
  const [retention, setRetention] = useState<RetentionMonth[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sv, rev, rem, ret] = await Promise.all([
        apiFetch<Summary>(`reports/summary?period=${period}&offset=${offset}`),
        apiFetch<ServiceEntry[]>(`reports/services?period=${period}&offset=${offset}`),
        apiFetch<RevenueMonth[]>(`reports/revenue-by-month?year=${revenueYear}`),
        apiFetch<UpcomingReminder[]>("reports/upcoming-reminders?days=30"),
        apiFetch<RetentionMonth[]>("reports/clients-retention"),
      ]);
      setSummary(s);
      setServices(sv);
      setRevenueByMonth(rev);
      setReminders(rem);
      setRetention(ret);
    } catch (err) {
      console.error("[ReportsView] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [period, offset, revenueYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const periodLabel = () => {
    if (!summary) return "";
    const start = new Date(summary.rangeStart).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
    const end = new Date(summary.rangeEnd).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
    if (period === "year") return new Date(summary.rangeStart).getFullYear().toString();
    if (period === "month")
      return new Date(summary.rangeStart).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
    return `${start} – ${end}`;
  };

  return (
    <div className="space-y-6">
      {/* Period controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["week", "month", "year"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setPeriod(p); setOffset(0); }}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {p === "week" ? "Semana" : p === "month" ? "Mes" : "Año"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm capitalize text-muted-foreground">
            {loading ? "…" : periodLabel()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setOffset((o) => o + 1)}
            disabled={offset >= 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            icon={DollarSign}
            tint="bg-emerald-500/15 text-emerald-400"
            label="Ingresos"
            value={formatCOP(summary.revenue.value)}
            delta={<DeltaBadge pct={summary.revenue.pct} />}
          />
          <MetricCard
            icon={CalendarDays}
            tint="bg-blue-500/15 text-blue-400"
            label="Citas"
            value={summary.appointments.value.toString()}
            delta={<DeltaBadge pct={summary.appointments.pct} />}
          />
          <MetricCard
            icon={Users}
            tint="bg-violet-500/15 text-violet-400"
            label="Propietarios nuevos"
            value={summary.newClients.value.toString()}
            delta={<DeltaBadge pct={summary.newClients.pct} />}
          />
          <MetricCard
            icon={PawPrint}
            tint="bg-amber-500/15 text-amber-400"
            label="Mascotas atendidas"
            value={summary.petsAttended.value.toString()}
            delta={<DeltaBadge pct={summary.petsAttended.pct} />}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by month */}
        <div className="rounded-xl border border-white/[0.06] bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ingresos por mes</h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRevenueYear((y) => y - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground">{revenueYear}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setRevenueYear((y) => y + 1)}
                disabled={revenueYear >= new Date().getFullYear()}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <RevenueBar months={revenueByMonth} />
          )}
        </div>

        {/* Top services */}
        <div className="rounded-xl border border-white/[0.06] bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold">Servicios más atendidos</h3>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-full rounded" />)}
            </div>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos para este período.</p>
          ) : (
            <div className="space-y-2">
              {services.map((s, i) => {
                const max = services[0].count;
                return (
                  <div key={s.name} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs text-muted-foreground">{i + 1}</span>
                    <div className="relative flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className="h-6 rounded bg-blue-500/40 transition-all"
                        style={{ width: `${(s.count / max) * 100}%` }}
                      />
                      <span className="absolute inset-0 flex items-center pl-2 text-xs font-medium">{s.name}</span>
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{s.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming reminders */}
      <div className="rounded-xl border border-white/[0.06] bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold">Próximas fechas críticas — 30 días</h3>
          {!loading && reminders.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{reminders.length}</Badge>
          )}
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
          </div>
        ) : reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin recordatorios próximos en los próximos 30 días.</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {reminders.map((r) => {
              const Icon = REMINDER_ICONS[r.type] ?? Bell;
              const tint = REMINDER_TINTS[r.type] ?? "bg-muted text-muted-foreground";
              const days = daysUntil(r.nextControlAt);
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tint)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.petName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.typeLabel} · {r.ownerName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium tabular-nums">{formatShortDate(r.nextControlAt)}</p>
                    <p
                      className={cn(
                        "text-[10px]",
                        days <= 3 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-muted-foreground"
                      )}
                    >
                      {days === 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Retention */}
      <div className="rounded-xl border border-white/[0.06] bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold">Retención — últimos 6 meses</h3>
        {loading ? (
          <Skeleton className="h-32 w-full rounded" />
        ) : retention.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-normal">Mes</th>
                  <th className="pb-2 text-right font-normal">Nuevos</th>
                  <th className="pb-2 text-right font-normal">Total citas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {retention.map((r) => (
                  <tr key={r.label}>
                    <td className="py-2 capitalize text-muted-foreground">{r.label}</td>
                    <td className="py-2 text-right tabular-nums text-violet-400">{r.newClients}</td>
                    <td className="py-2 text-right tabular-nums text-blue-400">{r.returningVisits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
