import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RecoveryMetrics = {
  reactivation: {
    contacted: number;
    reactivated: number;
    rate: number;
  };
  nextActions: {
    reminded: number;
    closed: number;
    rate: number;
  };
};

function RateBar({ rate }: { rate: number }) {
  const color =
    rate >= 50 ? "bg-green-500" : rate >= 25 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }} />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function RecoveryCard({ metrics }: { metrics: RecoveryMetrics }) {
  const { reactivation, nextActions } = metrics;
  const hasData = reactivation.contacted > 0 || nextActions.reminded > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          📊 Recuperación real
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            Sin datos aún. Empieza enviando recordatorios desde la bandeja de oportunidades.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Reactivación de clientes */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reactivación de clientes
              </p>
              <div className="flex gap-6">
                <Stat
                  label="Contactados"
                  value={reactivation.contacted}
                />
                <Stat
                  label="Volvieron"
                  value={reactivation.reactivated}
                  sub={`${reactivation.rate}% de conversión`}
                />
              </div>
              <RateBar rate={reactivation.rate} />
              <p className="text-xs text-muted-foreground">
                Clientes inactivos que agendaron cita después de recibir recordatorio
              </p>
            </div>

            {/* Acciones cerradas */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acciones pendientes
              </p>
              <div className="flex gap-6">
                <Stat
                  label="Con recordatorio"
                  value={nextActions.reminded}
                />
                <Stat
                  label="Completadas"
                  value={nextActions.closed}
                  sub={`${nextActions.rate}% de cierre`}
                />
              </div>
              <RateBar rate={nextActions.rate} />
              <p className="text-xs text-muted-foreground">
                Controles / vacunas / tratamientos marcados como hechos tras el recordatorio
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
