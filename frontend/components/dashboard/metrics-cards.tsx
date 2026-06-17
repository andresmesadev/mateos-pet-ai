import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MetricsData = {
  appointmentsThisWeek: { count: number; prev: number; delta: number };
  confirmationRate: { rate: number; prev: number; delta: number };
  newClientsThisMonth: { count: number; prev: number; delta: number };
};

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0)
    return <span className="text-xs text-muted-foreground">Sin cambio</span>;
  const positive = value > 0;
  return (
    <span
      className={`text-xs font-medium ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
    >
      {positive ? "↑" : "↓"} {positive ? "+" : ""}
      {value}
      {suffix} vs periodo anterior
    </span>
  );
}

export function MetricsCards({ metrics }: { metrics: MetricsData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Citas esta semana
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-3xl font-bold">{metrics.appointmentsThisWeek.count}</p>
          <Delta value={metrics.appointmentsThisWeek.delta} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tasa de confirmación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-3xl font-bold">{metrics.confirmationRate.rate}%</p>
          <Delta value={metrics.confirmationRate.delta} suffix="pp" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Clientes nuevos este mes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-3xl font-bold">{metrics.newClientsThisMonth.count}</p>
          <Delta value={metrics.newClientsThisMonth.delta} />
        </CardContent>
      </Card>
    </div>
  );
}
