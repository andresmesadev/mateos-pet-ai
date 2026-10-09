"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KIND_LABELS, METHOD_LABELS, reportComparisonText, reportMoney, reportRange, reportsAgree, type ReportSummary, type ReportBreakdown } from "@/lib/pos-reports";

type Snapshot = { summary: ReportSummary; breakdown: ReportBreakdown };
function ReportDocument({ summary, breakdown }: Snapshot) {
  return <article className="space-y-6 text-sm text-slate-900">
    <header className="border-b border-teal-700 pb-4"><p className="text-xs uppercase tracking-wider text-teal-800">Reporte del establecimiento · COP</p><h2 className="mt-2 text-2xl font-semibold">{summary.establishment.name}</h2><p className="mt-2">{reportRange(summary.rangeStart, summary.rangeEnd)}</p><p className="mt-1 text-xs text-slate-600">Consulta: {new Date(summary.asOf).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })} · Hora de Colombia</p></header>
    <section><h3 className="mb-3 font-semibold">Resumen financiero</h3><table className="w-full text-sm"><thead><tr className="border-b"><th className="py-2 text-left">Indicador</th><th className="py-2 text-right">Seleccionado</th><th className="py-2 text-right">Anterior</th></tr></thead><tbody>{[["Ingresos", summary.revenue], ["Gastos", summary.expenses], ["Ingresos − gastos", summary.difference]].map(([name, metric]) => { const point = metric as ReportSummary["revenue"]; return <tr key={String(name)} className="border-b"><th scope="row" className="py-2 text-left font-normal">{String(name)}</th><td className="py-2 text-right tabular-nums">{reportMoney(point.value)}</td><td className="py-2 text-right tabular-nums">{reportMoney(point.prev)}</td></tr>; })}</tbody></table><p className="mt-3 text-xs">Comparación: {reportRange(summary.previousRangeStart, summary.previousRangeEnd)}. {reportComparisonText(summary)}</p><p className="mt-2 text-xs text-slate-600">{summary.transactionCount} cobros activos. La diferencia no representa utilidad ni efectivo físico de caja.</p></section>
    <section><h3 className="mb-3 font-semibold">Medios de pago</h3><table className="w-full text-sm"><thead><tr className="border-b"><th className="py-2 text-left">Medio</th><th className="py-2 text-right">Cobros</th><th className="py-2 text-right">Importe</th></tr></thead><tbody>{breakdown.byMethod.map(row => <tr key={row.method} className="border-b"><th scope="row" className="py-2 text-left font-normal">{METHOD_LABELS[row.method]}</th><td className="text-right">{row.count}</td><td className="text-right tabular-nums">{reportMoney(row.total)}</td></tr>)}</tbody></table><p className="mt-2 text-xs text-slate-600">Por revisar: cobros de citas sin método confirmado por un responsable.</p></section>
    <section><h3 className="mb-3 font-semibold">Productos y servicios</h3><table className="w-full text-sm"><thead><tr className="border-b"><th className="py-2 text-left">Tipo</th><th className="py-2 text-right">Unidades</th><th className="py-2 text-right">Importe</th></tr></thead><tbody>{breakdown.byKind.map(row => <tr key={row.kind} className="border-b"><th scope="row" className="py-2 text-left font-normal">{KIND_LABELS[row.kind]}</th><td className="text-right">{row.quantity}</td><td className="text-right tabular-nums">{reportMoney(row.total)}</td></tr>)}</tbody></table>{breakdown.unallocatedTotal !== 0 && <p className="mt-2 text-xs">Diferencia sin detalle: {reportMoney(breakdown.unallocatedTotal)}.</p>}</section>
    <footer className="border-t pt-3 text-xs text-slate-600">Citas vigentes: {summary.appointments.value} · Clientes nuevos: {summary.newClients.value} · Mascotas atendidas: {summary.petsAttended.value}<p className="mt-2">Solo movimientos activos; anulaciones excluidas. La clasificación conserva los datos históricos.</p></footer>
  </article>;
}

export function ReportActions({ summary, breakdown, loading, refresh }: { summary?: ReportSummary; breakdown?: ReportBreakdown; loading: boolean; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Snapshot | null>(null);
  const ready = !loading && reportsAgree(summary, breakdown);
  async function download() {
    if (!ready || !summary || !breakdown || busy) return;
    const snapshot = { summary, breakdown };
    setBusy(true); setError("");
    try {
      const { createReportWorkbook, reportFilename } = await import("@/lib/pos-report-export");
      const buffer = await createReportWorkbook(snapshot.summary, snapshot.breakdown);
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer).buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = reportFilename(snapshot.summary); anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setError("No se pudo generar el Excel. Intenta exportarlo de nuevo."); }
    finally { setBusy(false); }
  }
  return <div className="mt-5 border-t pt-5">
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!ready || busy} onClick={download}><Download />{busy ? "Preparando Excel…" : "Exportar Excel"}</Button><Button variant="outline" disabled={!ready || busy} onClick={() => { if (summary && breakdown) setPreview({ summary, breakdown }); }}><Printer />Vista de impresión</Button><Button variant="ghost" disabled={loading || busy} onClick={refresh}><RefreshCw />Actualizar reportes</Button></div>
    {!ready && <p role="status" className="mt-2 text-xs text-muted-foreground">{loading ? "La exportación estará disponible al cargar el resumen y el desglose." : "Actualiza los reportes para exportar un resumen y desglose coincidentes."}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col"><DialogHeader><DialogTitle>Vista de impresión del reporte</DialogTitle><DialogDescription>Revisa la hoja antes de imprimirla o guardarla como PDF desde tu navegador.</DialogDescription></DialogHeader><div className="min-h-0 overflow-y-auto rounded-xl border p-4 sm:p-7">{preview && <ReportDocument {...preview} />}</div><DialogFooter><Button variant="outline" onClick={() => setPreview(null)}>Cerrar</Button><Button onClick={() => window.print()}><Printer />Imprimir reporte</Button></DialogFooter></DialogContent></Dialog>
    {preview && createPortal(<div data-report-print="true" className="hidden"><style>{`@media print { body > *:not([data-report-print]) { display: none !important; } body > [data-report-print] { display: block !important; } [data-report-print] { background: white; color: #0f172a; } [data-report-print] tr, [data-report-print] header { break-inside: avoid; } [data-report-print] thead { display: table-header-group; } } @page { size: A4; margin: 12mm; }`}</style><ReportDocument {...preview} /></div>, document.body)}
  </div>;
}
