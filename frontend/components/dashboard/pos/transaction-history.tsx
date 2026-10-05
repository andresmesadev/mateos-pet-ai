"use client";

import { useState } from "react";
import { Loader2, ReceiptText, Search, Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/lib/use-tenant";
import { PAYMENT_METHOD_LABELS, formatTransactionDate, type PaymentMethod, type Transaction } from "@/lib/transactions";
import { formatPosMoney } from "@/lib/pos-checkout";
import { canVoidSale, validHistoryRange, initialHistoryRange, historyQuickRange, inventoryReturnProgress, isHistoryTransaction, transactionNeedsReview, HISTORY_ORIGIN_LABELS, type HistoryOrigin, type HistoryQuickPeriod } from "@/lib/pos-history";
import { ReceiptDialog } from "./sale-receipt";
import { VoidSaleDialog } from "./void-sale-dialog";
import { InventoryReturnButton } from "@/components/dashboard/inventory/return-button";
import { type ReportDetail } from "@/lib/pos-reports";
import { ReportDetailContext } from "./report-detail-context";
import { useFinancialHistory } from "./use-financial-history";
import { HistoryPages } from "./history-pages";

const QUICK_PERIODS: [HistoryQuickPeriod, string][] = [["today", "Hoy"], ["yesterday", "Ayer"], ["week", "Últimos 7 días"], ["month", "Este mes"]];

export function TransactionHistory({ period, reportDetail }: { period: string; reportDetail?: ReportDetail }) {
  const tenant = useTenant();
  const access = useDashboardAccess();
  const router = useRouter();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const initial = reportDetail ? { from: reportDetail.from, to: reportDetail.to } : initialHistoryRange(period, today);
  const lastAllowed = reportDetail && reportDetail.to > today ? reportDetail.to : today;
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [range, setRange] = useState(initial);
  const [revision, setRevision] = useState(0);
  const [rangeError, setRangeError] = useState("");
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "all" | "review">(reportDetail?.kind === "review" ? "review" : "all");
  const [status, setStatus] = useState<"all" | "active" | "voided">(reportDetail ? "active" : "all");
  const [origin, setOrigin] = useState<HistoryOrigin>(reportDetail?.kind === "review" ? "system_appointment_completed" : "all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [voiding, setVoiding] = useState<Transaction | null>(null);
  const [uncertainSales, setUncertainSales] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");
  const params = new URLSearchParams({ ...range, pagination: "1", page: String(page), pageSize: String(pageSize), search: query, method, status, origin });
  if (tenant) params.set("tenantId", tenant);
  const { data, loading, error: failed } = useFinancialHistory("transactions", params, revision, isHistoryTransaction);
  const error = failed ? "No se pudo cargar el historial. Actualiza para intentarlo de nuevo." : "";
  function consult(next: { from: string; to: string }) {
    if (!validHistoryRange(next.from, next.to) || next.to > lastAllowed) {
      setRangeError(`Selecciona fechas válidas hasta ${lastAllowed}. Desde no puede ser posterior a Hasta.`); return;
    }
    setFrom(next.from); setTo(next.to); setRange(next); setRangeError(""); setNotice(""); setPage(1); setRevision(value => value + 1);
  }
  function clearFilters() { setQuery(""); setMethod("all"); setStatus("all"); setOrigin("all"); setPage(1); }
  const total = data?.total ?? 0;
  const summary = data?.summary;
  const displayed = data?.data ?? [];
  const selectClass = "mt-2 h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-sm";
  return <>
    {reportDetail && <ReportDetailContext detail={reportDetail} />}
    <section aria-label="Historial de cobros" className="overflow-hidden rounded-2xl border bg-white">
      <div className="space-y-5 border-b p-5 sm:p-6">
        <div className="flex flex-wrap gap-2" aria-label="Periodos rápidos">{QUICK_PERIODS.map(([key, label]) => {
          const next = historyQuickRange(today, key);
          const selected = range.from === next.from && range.to === next.to;
          return <Button key={key} type="button" variant={selected ? "default" : "outline"} aria-pressed={selected} onClick={() => consult(next)}>{label}</Button>;
        })}</div>
        <form noValidate onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); consult({ from: String(values.get("from") || ""), to: String(values.get("to") || "") }); }} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="min-w-0 text-sm font-medium">Desde<Input type="date" name="from" aria-label="Historial desde" max={lastAllowed} className="mt-2 min-w-0" value={from} onChange={event => setFrom(event.target.value)} /></label>
          <label className="min-w-0 text-sm font-medium">Hasta<Input type="date" name="to" aria-label="Historial hasta" max={lastAllowed} className="mt-2 min-w-0" value={to} onChange={event => setTo(event.target.value)} /></label>
          <Button type="submit">Consultar fechas</Button>
        </form>
        {rangeError && <p role="alert" className="text-sm text-destructive">{rangeError}</p>}
        <label className="block text-sm font-medium">Buscar operación<span className="relative mt-2 block"><Search aria-hidden className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input type="search" className="pl-9" placeholder="Cliente, mascota, artículo, quien registró o referencia" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></span></label>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="min-w-0 text-sm font-medium">Origen<select className={selectClass} value={origin} onChange={event => { setOrigin(event.target.value as HistoryOrigin); setPage(1); }}><option value="all">Todos los orígenes</option>{Object.entries(HISTORY_ORIGIN_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="min-w-0 text-sm font-medium">Método de pago<select className={selectClass} value={method} onChange={event => { setMethod(event.target.value as typeof method); setPage(1); }}><option value="all">Todos los métodos</option><option value="review">Por revisar</option>{Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="min-w-0 text-sm font-medium">Estado<select className={selectClass} value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); }}><option value="all">Todas</option><option value="active">Activas</option><option value="voided">Anuladas</option></select></label>
          <Button variant="ghost" onClick={clearFilters}>Limpiar filtros</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background/60 px-5 py-4 text-sm"><p><strong>{loading || error ? "…" : total}</strong> {total === 1 && !loading ? "operación" : "operaciones"} · {range.from} a {range.to}</p><Button variant="outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>Actualizar</Button></div>
      {notice && <p role="status" className="border-b bg-emerald-50 px-5 py-4 text-sm text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="border-b bg-amber-50 px-5 py-4 text-sm text-amber-950">{error}</p>}
      {!loading && !error && summary && <div aria-label="Resumen del historial filtrado" className="grid gap-3 border-b p-5 sm:grid-cols-3">{[
        ["Importe activo del período", formatPosMoney(summary.activeTotal)], ["Operaciones activas", String(summary.activeCount)], ["Operaciones anuladas", String(summary.voidedCount)],
      ].map(([label, value]) => <div key={label} className="rounded-xl bg-background p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p></div>)}<p className="text-xs text-muted-foreground sm:col-span-3">Resumen de todas las páginas de esta lista con los filtros aplicados. Incluye cobros de citas cuyo método está por revisar; las anuladas se excluyen del importe activo.</p></div>}
      {loading ? <p role="status" className="flex items-center justify-center gap-2 p-10 text-sm"><Loader2 className="h-5 w-5 animate-spin text-primary" />Cargando operaciones…</p> : error ? <div className="p-8 text-center"><Button variant="outline" onClick={() => setRevision(value => value + 1)}>Reintentar historial</Button></div> : !total ? <div className="p-10 text-center"><ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-semibold">Sin operaciones con estos filtros</p><p className="mt-1 text-sm text-muted-foreground">Revisa las fechas o limpia los filtros de la lista.</p><Button variant="outline" className="mt-4" onClick={clearFilters}>Limpiar filtros</Button></div> : <>
        <ul className="divide-y" aria-label="Operaciones encontradas">{displayed.map(transaction => {
          const progress = inventoryReturnProgress(transaction);
          const review = transactionNeedsReview(transaction);
          return <li key={transaction.id} className="p-5 sm:p-6">
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-semibold">{transaction.clientName || transaction.clientPhone || "Venta de mostrador"}</h3>{transaction.petName && <span className="text-sm text-muted-foreground">· {transaction.petName}</span>}<span className={`rounded-full px-2 py-1 text-xs font-medium ${transaction.status === "voided" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{transaction.status === "voided" ? "Anulada" : "Activa"}</span><span className="rounded-full bg-muted/40 px-2 py-1 text-xs">{HISTORY_ORIGIN_LABELS[transaction.origin || "legacy"]}</span></div>
                <p className="mt-2 text-sm text-muted-foreground">{formatTransactionDate(transaction.paidAt)} · {review ? "Método por revisar" : PAYMENT_METHOD_LABELS[transaction.paymentMethod]}</p>
                <p className="mt-1 text-sm text-muted-foreground">Registró: {transaction.recordedBy?.name || (review ? "Generado al completar la cita" : transaction.recordedBy?.id ? "Nombre no disponible" : "No registrado")}</p>
                <p className="mt-2 truncate text-sm">{transaction.items.map(item => `${item.quantity} × ${item.description}`).join(" · ")}</p>
                {transaction.status === "voided" && progress.pending.length + progress.received.length > 0 && <p className="mt-2 text-sm text-amber-900">Mercancía: {progress.pending.length} {progress.pending.length === 1 ? "línea" : "líneas"} por recibir · {progress.received.length} {progress.received.length === 1 ? "recibida" : "recibidas"}</p>}
                <details className="mt-3 text-sm"><summary className="w-fit cursor-pointer font-medium text-primary">Ver detalle de operación</summary><div className="mt-3 space-y-3 rounded-xl border bg-background/40 p-4">
                  <p className="break-all text-xs text-muted-foreground">Ref. {transaction.id}</p>
                  {transaction.recordedBy?.id && !transaction.recordedBy.name && <p className="break-all text-xs text-muted-foreground">Identificador de quien registró: {transaction.recordedBy.id}</p>}
                  {transaction.clientPhone && <p className="text-sm">Teléfono: {transaction.clientPhone}</p>}
                  <ul className="space-y-3">{transaction.items.map(item => <li key={item.id}><p className="break-words font-medium">{item.description}</p><p className="text-xs text-muted-foreground">{item.quantity} × {formatPosMoney(item.unitPrice)} · {formatPosMoney(item.total)}</p>{item.inventoryReturn ? <p className="mt-1 text-xs text-emerald-800">{item.inventoryReturn.quantity} unidades recibidas · {item.inventoryReturn.disposition === "restock" ? "Repuestas en inventario" : "Sin reposición"}</p> : transaction.status === "voided" && item.productId ? <p className="mt-1 text-xs text-amber-900">Mercancía pendiente de recibir. Su salida de inventario se conserva.</p> : null}</li>)}</ul>
                  {transaction.notes && <p className="whitespace-pre-wrap break-words text-sm">Notas: {transaction.notes}</p>}
                  {transaction.status === "voided" && <div className="rounded-lg bg-red-50 p-3 text-red-900"><p className="whitespace-pre-wrap break-words"><strong>Motivo de anulación:</strong> {transaction.voidReason || "No registrado"}</p>{transaction.voidedAt && <p className="mt-1 text-xs">{formatTransactionDate(transaction.voidedAt)}</p>}</div>}
                </div></details>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 xl:block xl:text-right"><p className={`text-xl font-bold tabular-nums ${transaction.status === "voided" ? "text-muted-foreground line-through" : "text-primary"}`}>{formatPosMoney(transaction.total)}</p><div className="flex flex-wrap gap-2 xl:mt-3 xl:justify-end">
                <Button variant="outline" onClick={() => setReceipt(transaction)}><ReceiptText aria-hidden className="mr-2 h-4 w-4" />Comprobante</Button>
                {canVoidSale(transaction, !!access?.capabilities.finance) && <Button variant="ghost" className="text-destructive" onClick={() => setVoiding(transaction)}><Ban aria-hidden className="mr-2 h-4 w-4" />Anular</Button>}
                <InventoryReturnButton transaction={transaction} onSaved={async () => { setNotice("Devolución registrada. Puedes consultar las unidades recibidas en esta venta y en Inventario."); setRevision(value => value + 1); router.refresh(); }} />
              </div></div>
            </div>
          </li>;
        })}</ul>
        {data && <HistoryPages data={data} onPage={setPage} onSize={size => { setPageSize(size); setPage(1); }} />}
      </>}
      <p className="border-t px-5 py-4 text-xs text-muted-foreground">Los cobros de citas completadas se revisan en Caja diaria. Anular una venta no realiza un reembolso bancario ni repone mercancía: registra su recepción por separado.</p>
    </section>
    <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />
    {voiding && <VoidSaleDialog key={voiding.id} transaction={voiding} initiallyUncertain={uncertainSales.has(voiding.id)} onUncertainChange={value => setUncertainSales(previous => { const next = new Set(previous); if (value) next.add(voiding.id); else next.delete(voiding.id); return next; })} onClose={() => setVoiding(null)} onConfirmed={() => { setRevision(value => value + 1); setNotice("Venta anulada. El registro original y el motivo se conservan."); router.refresh(); }} />}
  </>;
}
