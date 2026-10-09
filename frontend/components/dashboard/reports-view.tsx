"use client";

import { useState } from "react";
import Link from "next/link";
import { useTenant } from "@/lib/use-tenant";
import { ReportActions } from "@/components/dashboard/pos/report-actions";
import { reportComparisonText, reportDetailUrl, type ReportComparison, type ReportSelection } from "@/lib/pos-reports";
import { ChevronLeft, ChevronRight, RotateCcw, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportSection, useReportData } from "@/components/dashboard/pos/report-section";
import { KIND_LABELS, METHOD_LABELS, REPORT_MONTHS, parseActivity, parseBreakdown, parseReportSummary, parseRevenueMonths, parseServices, reportBarHeight, reportDate, reportMoney, reportRange, type MetricPoint, type ReportPeriod } from "@/lib/pos-reports";

function Comparison({ metric, money = false }: { metric: MetricPoint; money?: boolean }) {
  const Icon = metric.delta > 0 ? ArrowUpRight : metric.delta < 0 ? ArrowDownRight : Minus;
  return <p className="mt-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />
    {metric.pct === null ? "Sin base porcentual" : `${metric.pct > 0 ? "+" : ""}${metric.pct}%`}
    <span>· {metric.delta > 0 ? "+" : ""}{money ? reportMoney(metric.delta) : metric.delta} vs. período anterior</span>
  </p>;
}

export function ReportsView({ initial }: { initial?: ReportSelection }) {
  const tenant = useTenant();
  const [period, setPeriod] = useState<ReportPeriod>(initial?.period ?? "month");
  const [offset, setOffset] = useState(initial?.offset ?? 0);
  const [comparison, setComparison] = useState<ReportComparison>(initial?.comparison ?? "full");
  const query = new URLSearchParams({ period, offset: String(offset), comparison }).toString();
  const summary = useReportData(`reports/summary?${query}`, parseReportSummary);
  const breakdown = useReportData(`reports/breakdown?${query}`, parseBreakdown);
  const services = useReportData(`reports/services?${query}`, parseServices);
  const annual = useReportData(`reports/revenue-by-month?${query}`, parseRevenueMonths);
  const activity = useReportData("reports/clients-retention", parseActivity);
  const periodName = { week: "Semana", month: "Mes", year: "Año" }[period];
  const dates = summary.data ?? breakdown.data;

  return <div className="space-y-6">
    <section aria-label="Período de reportes" className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><h2 className="text-2xl font-semibold">Reportes del negocio</h2><p className="mt-1 text-sm text-muted-foreground">Consulta los resultados de tu establecimiento. Importes en COP y fechas en hora de Colombia.</p></div>
        <div role="group" aria-label="Tipo de período" className="flex gap-1 rounded-xl bg-muted p-1">
          {(["week", "month", "year"] as const).map(value => <Button key={value} variant={period === value ? "default" : "ghost"} aria-pressed={period === value} onClick={() => { setPeriod(value); setOffset(0); }}>{ { week: "Semana", month: "Mes", year: "Año" }[value]}</Button>)}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-5">
        <Button variant="outline" size="icon" aria-label={`${periodName} anterior`} disabled={offset <= -1200} onClick={() => setOffset(value => value - 1)}><ChevronLeft /></Button>
        <div className="min-w-0 flex-1"><p className="font-semibold">{periodName} {offset === 0 ? "actual" : `anterior (${Math.abs(offset)})`}</p><p className="mt-1 text-sm text-muted-foreground">{dates ? reportRange(dates.rangeStart, dates.rangeEnd) : summary.error && breakdown.error ? "Las fechas no están disponibles. Reintenta la consulta." : "Consultando fechas del período…"}</p></div>
        <Button variant="outline" size="icon" aria-label={`${periodName} siguiente`} disabled={offset === 0} onClick={() => setOffset(value => Math.min(0, value + 1))}><ChevronRight /></Button>
        {offset !== 0 && <Button variant="outline" onClick={() => setOffset(0)}><RotateCcw />Volver al período actual</Button>}
      </div>
      <label className="mt-5 block text-sm font-medium">Comparar con<select className="mt-2 h-11 w-full rounded-xl border bg-white px-3 sm:max-w-sm" value={comparison} onChange={event => setComparison(event.target.value as ReportComparison)}><option value="full">Período anterior completo</option><option value="equivalent">Los mismos días del calendario</option></select></label>
      <ReportActions summary={summary.data} breakdown={breakdown.data} loading={summary.loading || breakdown.loading} refresh={() => { summary.retry(); breakdown.retry(); services.retry(); annual.retry(); activity.retry(); }} />
    </section>

    <ReportSection title="Resumen del período" description="Ingresos y gastos activos. Los movimientos anulados quedan excluidos." result={summary}>
      {data => <div className="space-y-5">
        <div className="flex flex-wrap justify-between gap-2 text-sm"><p className="font-medium">{reportRange(data.rangeStart, data.rangeEnd)}</p><p className="text-muted-foreground">Actualizado: {new Date(data.asOf).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })}</p></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {([{ label: "Ingresos", point: data.revenue, detail: `${data.transactionCount} cobros activos`, tone: "border-emerald-200 bg-emerald-50/60 text-emerald-800" }, { label: "Gastos", point: data.expenses, detail: "Gastos registrados", tone: "border-rose-200 bg-rose-50/60 text-rose-800" }, { label: "Diferencia del período", point: data.difference, detail: "Ingresos − gastos", tone: "border-primary/20 bg-primary/5 text-primary" }]).map((card, index) => <div key={card.label} className={`min-w-0 rounded-xl border p-5 ${card.tone}`}><h4 className="font-medium">{card.label}</h4><p className="mt-3 break-words text-3xl font-semibold tabular-nums">{reportMoney(card.point.value)}</p><p className="mt-2 text-xs">{card.detail}</p><Comparison metric={card.point} money />{index < 2 && <Button asChild variant="outline" size="sm" className="mt-4 bg-white"><Link href={reportDetailUrl(data, index === 0 ? "income" : "expense", tenant)}>Ver {index === 0 ? "ingresos" : "gastos"}</Link></Button>}</div>)}
        </div>
        <p className="text-sm text-muted-foreground">La diferencia no representa la utilidad ni el efectivo físico de caja. Los cobros de citas completadas ya cuentan como ingreso, aunque su método de pago esté por revisar.</p>
        <div className="rounded-xl bg-muted/60 p-4 text-sm"><p className="font-medium">Comparación: {reportRange(data.previousRangeStart, data.previousRangeEnd)}</p><p className="mt-1 text-muted-foreground">{reportComparisonText(data)}</p></div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[{ label: "Citas vigentes", point: data.appointments, note: "Excluye canceladas y no asistidas" }, { label: "Clientes nuevos", point: data.newClients, note: "Registrados durante el período" }, { label: "Mascotas atendidas", point: data.petsAttended, note: "Mascotas distintas con expediente vinculado y cita completada" }].map(card => <div key={card.label} className="rounded-xl border p-4"><h4 className="text-sm font-medium">{card.label}</h4><p className="mt-2 text-2xl font-semibold tabular-nums">{card.point.value}</p><p className="mt-1 text-xs text-muted-foreground">{card.note}</p><Comparison metric={card.point} /></div>)}
        </div>
      </div>}
    </ReportSection>

    <ReportSection title="Composición de los ingresos" description="Medios de pago y artículos de los cobros activos del período seleccionado." result={breakdown}>
      {data => <div className="space-y-5">
        <p className="text-sm text-muted-foreground">{reportRange(data.rangeStart, data.rangeEnd)} · {data.count} cobros · <strong className="text-foreground">{reportMoney(data.total)}</strong></p>
        <div className="grid gap-6 xl:grid-cols-2">
          <div><h4 className="mb-3 font-medium">Medios de pago</h4><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="pb-3 font-medium">Medio</th><th className="pb-3 text-right font-medium">Cobros</th><th className="pb-3 text-right font-medium">Importe</th></tr></thead><tbody>{data.byMethod.map(row => <tr key={row.method} className="border-b last:border-0"><th scope="row" className="py-3 text-left font-normal">{row.method === "review" && row.count > 0 ? <Link className="font-medium text-primary underline underline-offset-4" href={reportDetailUrl(data, "review", tenant)}>Por revisar: ver cobros</Link> : METHOD_LABELS[row.method]}</th><td className="px-2 text-right tabular-nums">{row.count}</td><td className="text-right tabular-nums">{reportMoney(row.total)}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">Por revisar: cobros de citas sin método confirmado por un responsable. Sin identificar: medios históricos fuera del catálogo actual.</p></div>
          <div><h4 className="mb-3 font-medium">Productos y servicios</h4><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="pb-3 font-medium">Tipo</th><th className="pb-3 text-right font-medium">Unidades</th><th className="pb-3 text-right font-medium">Importe</th></tr></thead><tbody>{data.byKind.map(row => <tr key={row.kind} className="border-b last:border-0"><th scope="row" className="py-3 text-left font-normal">{KIND_LABELS[row.kind]}</th><td className="px-2 text-right tabular-nums">{row.quantity}</td><td className="text-right tabular-nums">{reportMoney(row.total)}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">La clasificación utiliza los datos guardados en cada artículo. Los registros antiguos sin tipo se conservan como sin clasificación.</p>{data.unallocatedTotal !== 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Diferencia sin detalle de artículos: {reportMoney(data.unallocatedTotal)}. Se conserva el importe original del cobro.</p>}</div>
        </div>
      </div>}
    </ReportSection>
    {/* Annual and operational context stay visibly separate from the period totals. */}
    <ReportSection title="Ingresos por mes" description="Contexto anual: el año en el que comienza el período seleccionado." result={annual}>
      {months => <div className="space-y-5">
        <div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">Año {months[0].year}</h4><p className="text-sm text-muted-foreground">Total del año: <strong className="text-foreground">{reportMoney(months.reduce((sum, row) => sum + Math.round(row.revenue * 100), 0) / 100)}</strong></p></div>
        {months.every(row => row.revenue === 0) ? <p className="rounded-xl bg-muted/50 p-5 text-sm text-muted-foreground">No hay ingresos activos registrados en este año.</p> : <div aria-hidden="true" className="flex items-end gap-1 sm:gap-3">{months.map(row => <div key={row.month} className="min-w-0 flex-1"><div className="flex h-[150px] items-end"><div className="w-full rounded-t bg-primary/75" style={{ height: reportBarHeight(row.revenue, Math.max(...months.map(value => value.revenue))) }} /></div><p className="mt-2 text-center text-[10px] text-muted-foreground sm:text-xs">{REPORT_MONTHS[row.month - 1]}</p></div>)}</div>}
        <details className="rounded-xl border p-4" open><summary className="cursor-pointer text-sm font-medium">Ver importes exactos por mes</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Ingresos activos por mes del año {months[0].year}</caption><thead className="border-b"><tr><th className="pb-2 text-left font-medium">Mes</th><th className="pb-2 text-right font-medium">Ingresos (COP)</th></tr></thead><tbody>{months.map(row => <tr key={row.month} className="border-b last:border-0"><th scope="row" className="py-2 text-left font-normal">{REPORT_MONTHS[row.month - 1]} {row.year}</th><td className="py-2 text-right tabular-nums">{reportMoney(row.revenue)}</td></tr>)}</tbody></table></div></details>
        <p className="text-xs text-muted-foreground">Los meses futuros permanecen en cero hasta que haya cobros registrados.</p>
      </div>}
    </ReportSection>

    <div className="grid items-start gap-6 xl:grid-cols-2">
      <ReportSection title="Servicios más atendidos" description="Hasta diez servicios con citas completadas en el período seleccionado." result={services}>
        {rows => rows.length === 0 ? <p className="text-sm text-muted-foreground">No hay citas completadas en este período.</p> : <ol className="space-y-4">{rows.map((row, index) => <li key={row.name}><div className="flex items-start justify-between gap-4 text-sm"><span className="min-w-0 break-words">{index + 1}. {row.name}</span><strong className="shrink-0 tabular-nums">{row.count} {row.count === 1 ? "atención" : "atenciones"}</strong></div><div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/60" style={{ width: `${row.count / Math.max(rows[0].count, 1) * 100}%` }} /></div></li>)}</ol>}
      </ReportSection>
      <ReportSection title="Actividad de clientes" description="Últimos seis meses hasta el mes actual, independiente del período seleccionado." result={activity}>
        {rows => <div><p className="mb-4 text-sm text-muted-foreground">{rows[0].label} – {rows[rows.length - 1].label}. Son clientes registrados y cantidad de citas; no mide retención.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-muted-foreground"><tr><th className="pb-3 font-medium">Mes</th><th className="pb-3 text-right font-medium">Clientes nuevos</th><th className="pb-3 pl-3 text-right font-medium">Citas vigentes</th></tr></thead><tbody>{rows.map(row => <tr key={row.label} className="border-b last:border-0"><th scope="row" className="py-3 text-left font-normal">{row.label}</th><td className="text-right tabular-nums">{row.newClients}</td><td className="pl-3 text-right tabular-nums">{row.returningVisits}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">Las citas excluyen canceladas y no asistidas. El mes actual está en curso.</p></div>}
      </ReportSection>
    </div>
    <p className="text-xs text-muted-foreground">Los seguimientos y recordatorios se consultan desde Inicio y el expediente de la mascota.{dates && ` Última consulta: ${reportDate(dates.asOf)}.`}</p>
  </div>;
}
