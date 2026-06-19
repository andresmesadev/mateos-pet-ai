import {
  CalendarDays,
  UserPlus,
  DollarSign,
  PawPrint,
  Bell,
} from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { type DailyMetrics } from "@/components/dashboard/home/fetchers";

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function DeltaPct({ count, prev }: { count: number; prev: number }) {
  if (prev === 0 && count === 0) {
    return <span className="text-xs text-muted-foreground">Sin cambio vs ayer</span>;
  }
  const pct = prev === 0 ? 100 : Math.round(((count - prev) / prev) * 100);
  if (pct === 0) {
    return <span className="text-xs text-muted-foreground">Sin cambio vs ayer</span>;
  }
  const positive = pct > 0;
  return (
    <span className={`text-xs font-medium ${positive ? "text-emerald-500" : "text-red-400"}`}>
      {positive ? "↑" : "↓"} {positive ? "+" : ""}
      {pct}% vs ayer
    </span>
  );
}

export function DailyMetricsCards({ metrics }: { metrics: DailyMetrics }) {
  const m = metrics;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <MetricCard
        size="sm"
        icon={CalendarDays}
        tint="bg-teal-500/15 text-teal-400"
        label="Citas de hoy"
        value={String(m.appointmentsToday.count)}
        delta={<DeltaPct count={m.appointmentsToday.count} prev={m.appointmentsToday.prev} />}
      />
      <MetricCard
        size="sm"
        icon={UserPlus}
        tint="bg-violet-500/15 text-violet-400"
        label="Clientes nuevos"
        value={String(m.newClientsToday.count)}
        delta={<DeltaPct count={m.newClientsToday.count} prev={m.newClientsToday.prev} />}
      />
      <MetricCard
        size="sm"
        icon={DollarSign}
        tint="bg-amber-500/15 text-amber-400"
        label="Ingresos del día"
        value={formatCOP(m.revenueToday.count)}
        delta={<DeltaPct count={m.revenueToday.count} prev={m.revenueToday.prev} />}
      />
      <MetricCard
        size="sm"
        icon={PawPrint}
        tint="bg-sky-500/15 text-sky-400"
        label="Mascotas atendidas"
        value={String(m.petsAttendedToday.count)}
        delta={<DeltaPct count={m.petsAttendedToday.count} prev={m.petsAttendedToday.prev} />}
      />
      <MetricCard
        size="sm"
        icon={Bell}
        tint="bg-rose-500/15 text-rose-400"
        label="Recordatorios enviados"
        value={String(m.remindersSentToday.count)}
        delta={<DeltaPct count={m.remindersSentToday.count} prev={m.remindersSentToday.prev} />}
      />
    </div>
  );
}
