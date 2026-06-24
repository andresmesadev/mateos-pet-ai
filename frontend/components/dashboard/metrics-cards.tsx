import { CalendarCheck, CheckCircle2, UserPlus } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";

type MetricsData = {
  appointmentsThisWeek: { count: number; prev: number; delta: number };
  confirmationRate: { rate: number; prev: number; delta: number };
  newClientsThisMonth: { count: number; prev: number; delta: number };
};

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0)
    return <span className="text-xs text-muted-foreground">Sin cambio vs periodo anterior</span>;
  const positive = value > 0;
  return (
    <span
      className={`text-xs font-medium ${positive ? "text-emerald-500" : "text-red-400"}`}
    >
      {positive ? "↑" : "↓"} {positive ? "+" : ""}
      {value}
      {suffix} vs periodo anterior
    </span>
  );
}

export function MetricsCards({ metrics }: { metrics: MetricsData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        icon={CalendarCheck}
        tint="bg-teal-500/15 text-teal-400"
        label="Citas esta semana"
        value={String(metrics.appointmentsThisWeek.count)}
        delta={<Delta value={metrics.appointmentsThisWeek.delta} />}
      />
      <MetricCard
        icon={CheckCircle2}
        tint="bg-emerald-500/15 text-emerald-400"
        label="Tasa de confirmación"
        value={`${metrics.confirmationRate.rate}%`}
        delta={<Delta value={metrics.confirmationRate.delta} suffix="pp" />}
      />
      <MetricCard
        icon={UserPlus}
        tint="bg-violet-500/15 text-violet-400"
        label="Clientes nuevos este mes"
        value={String(metrics.newClientsThisMonth.count)}
        delta={<Delta value={metrics.newClientsThisMonth.delta} />}
      />
    </div>
  );
}
