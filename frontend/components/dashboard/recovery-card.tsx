import type { RecoveryMetrics } from "@/lib/customer-followup";
export function RecoveryCard({ metrics, grooming = true }: { metrics: RecoveryMetrics; grooming?: boolean }) {
  const stats = [
    ...(grooming ? [{ title: "Clientes contactados", value: metrics.reactivation.contacted, detail: "Con al menos un contacto de reactivación registrado." }, { title: "Clientes que regresaron", value: metrics.reactivation.reactivated, detail: "Con una cita completada o una visita de peluquería posterior al último contacto." }] : []),
    { title: "Pendientes con recordatorio", value: metrics.nextActions.reminded, detail: "Acciones del expediente con un envío de recordatorio registrado." },
    { title: "Pendientes realizados", value: metrics.nextActions.closed, detail: "De las acciones con recordatorio, las marcadas como realizadas." },
  ];
  return <section className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm"><div><h2 className="text-xl font-semibold">Resultados del seguimiento</h2><p className="mt-2 text-sm text-muted-foreground">Acumulado histórico del establecimiento. Estos datos muestran actividad registrada; no atribuyen un regreso al mensaje enviado.</p></div><div className={`grid gap-4 sm:grid-cols-2 ${grooming ? "xl:grid-cols-4" : ""}`}>{stats.map(s => <div key={s.title} className="rounded-xl border bg-teal-50/40 p-5"><h3 className="text-sm font-semibold">{s.title}</h3><p className="my-3 text-3xl font-semibold tabular-nums">{s.value}</p><p className="text-sm text-muted-foreground">{s.detail}</p></div>)}</div><p className="text-sm text-muted-foreground">Un cero significa que aún no hay actividad registrada para ese indicador. Puedes revisar cada mascota desde Pendientes.</p></section>;
}
