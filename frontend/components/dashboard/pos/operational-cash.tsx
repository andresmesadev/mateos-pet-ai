"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Loader2, ReceiptText, RefreshCw, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { dashboardRequest } from "@/lib/dashboard-request";
import { PAYMENT_METHOD_LABELS, formatTransactionDate, type PaymentMethod, type Transaction } from "@/lib/transactions";
import { formatPosMoney } from "@/lib/pos-checkout";
import { getPetEmoji } from "@/lib/pets";
import { useTenant } from "@/lib/use-tenant";
import { useDashboardAccess } from "../dashboard-access-provider";
import { ReceiptDialog } from "./sale-receipt";
import { ReviewPaymentDialog, type PaymentAttempt } from "./review-payment-dialog";
import { isCashData, type CashData, type CashFilter, type CashMethod } from "@/lib/pos-cash";
import { HistoryPages } from "./history-pages";

export function OperationalCash() {
  const tenant = useTenant(), access = useDashboardAccess(), router = useRouter(), params = useSearchParams();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [scope, setScope] = useState<"day" | "pending">(() => params.get("review") === "1" ? "pending" : "day");
  const [date, setDate] = useState(today), [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CashFilter>("all"), [paymentFilter, setPaymentFilter] = useState<CashMethod>("all");
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: CashData; error?: string }>({ key: "" });
  const [selected, setSelected] = useState<Transaction | null>(null), [receipt, setReceipt] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState<Record<string, PaymentAttempt>>({});
  const reviewTrigger = useRef<HTMLButtonElement | null>(null);
  const queryParams = new URLSearchParams({ scope, date, page: String(page), pageSize: String(pageSize), search: query, filter, method: scope === "pending" ? "all" : paymentFilter });
  if (tenant) queryParams.set("tenantId", tenant);
  const url = proxyUrl(`/api/dashboard/cash/operational?${queryParams}`), key = `${url}:${revision}`;
  const loading = result.key !== key, data = loading ? undefined : result.data, error = loading ? "" : result.error;
  const load = () => setRevision(value => value + 1);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { response, payload } = await dashboardRequest(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok || !isCashData(payload)) throw new Error("No se pudieron cargar los cobros. Intenta de nuevo.");
        if (current) setResult({ key, data: payload });
      } catch (cause) { if (current) setResult({ key, error: cause instanceof Error ? cause.message : "No se pudo cargar Caja." }); }
    }, 250);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [url, key]);
  const reviewIds = new Set(data?.toReview ?? []), summary = data?.summaryCash;
  const saleHref = `/dashboard/pos?tab=venta${tenant ? "&tenant=" + encodeURIComponent(tenant) : ""}`;
  function choose(next: "day" | "pending") { setScope(next); setFilter("all"); setPaymentFilter("all"); setPage(1); setNotice(""); }
  return <section className="min-w-0 overflow-hidden rounded-2xl border bg-white">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-5 sm:px-6"><div><h3 className="flex items-center gap-2 text-lg font-bold"><Wallet className="h-5 w-5 text-primary" />{scope === "pending" ? "Pagos por revisar" : date === today ? "Cobros de hoy" : "Cobros de la fecha"}</h3><p className="mt-1 text-sm text-muted-foreground">{scope === "pending" ? "Servicios pendientes de confirmar · Todas las fechas" : "Ventas y servicios de la jornada · Hora de Colombia"}</p></div><div className="flex flex-wrap gap-2"><Button asChild><Link href={saleHref}>Nuevo cobro</Link></Button><Button variant="outline" disabled={loading} onClick={() => { load(); router.refresh(); }}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button></div></header>
    <div className="space-y-4 px-5 py-5 sm:px-6">
      <div role="group" aria-label="Consulta de Caja" className="flex flex-wrap gap-2"><Button variant={scope === "day" ? "default" : "outline"} aria-pressed={scope === "day"} onClick={() => choose("day")}>Cobros por fecha</Button><Button variant={scope === "pending" ? "default" : "outline"} aria-pressed={scope === "pending"} onClick={() => choose("pending")}>Pendientes de todas las fechas{data ? ` (${data.pendingCount})` : ""}</Button></div>
      {scope === "day" && access?.capabilities.administration && <label className="block max-w-xs text-sm font-medium">Fecha de los cobros<Input type="date" className="mt-2" max={today} value={date} onChange={event => { setDate(event.target.value); setPage(1); }} /></label>}
      {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</p>}
      {error && <div role="alert" className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p>{error}</p><Button variant="outline" onClick={load}>Reintentar Caja</Button></div>}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]"><div><label htmlFor="cash-search" className="mb-2 block text-sm font-medium">Buscar un movimiento</label><div className="relative"><Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="cash-search" type="search" maxLength={200} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Cliente, mascota, artículo o número" className="pl-10" /></div></div>{scope === "day" && <label className="text-sm font-medium">Medio de pago<select className="mt-2 block h-11 w-full rounded-xl border bg-white px-3 text-sm" value={paymentFilter} onChange={event => { setPaymentFilter(event.target.value as CashMethod); setPage(1); }}><option value="all">Todos los medios</option>{Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => <option key={method} value={method}>{label}</option>)}</select></label>}</div>
      {scope === "day" && <div role="group" aria-label="Filtrar movimientos" className="flex flex-wrap gap-2">{([{ value: "all", label: "Todos" }, { value: "review", label: "Por revisar" }, { value: "registered", label: "Método confirmado" }] as const).map(item => <Button key={item.value} variant={filter === item.value ? "default" : "outline"} aria-pressed={filter === item.value} onClick={() => { setFilter(item.value); setPage(1); if (item.value === "review") setPaymentFilter("all"); }}>{item.label}</Button>)}</div>}
      {loading && <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando los movimientos de Caja…</p>}
      {data && summary && <>
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><p>{scope === "pending" ? "Todas las fechas" : new Date(data.date + "T12:00:00-05:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" })} · {data.total} movimientos</p><p>Importe del filtro: <strong className="text-foreground">{formatPosMoney(data.totalRegistered)}</strong></p></div>
        <dl className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {Object.entries(summary.methods).map(([method, value]) => <div key={method} className="min-w-0 rounded-xl border bg-muted/30 p-4"><dt className="text-sm font-medium">{PAYMENT_METHOD_LABELS[method as PaymentMethod]}</dt><dd className="mt-2 break-words text-xl font-bold tabular-nums">{formatPosMoney(value.cents / 100)}</dd><dd className="mt-1 text-xs text-muted-foreground">{value.count} con método confirmado</dd></div>)}
          <div className="col-span-2 min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 xl:col-span-1"><dt className="text-sm font-medium">Por revisar</dt><dd className="mt-2 break-words text-xl font-bold tabular-nums">{formatPosMoney(summary.reviewCents / 100)}</dd><dd className="mt-1 text-xs">{summary.reviewCount} con método por confirmar</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">Los importes y conteos incluyen todas las páginas del filtro aplicado.</p>
        {summary.reviewCount > 0 && <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" />Los servicios de citas completadas ya cuentan como ingresos. Confirma su método de pago; no registres otra venta por el mismo servicio.</p>}
        <div className="divide-y">{data.data.map(transaction => <div key={transaction.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-words font-semibold">{transaction.petName ? `${getPetEmoji(transaction.petType ?? "")} ${transaction.petName}` : transaction.clientName || "Venta de mostrador"}</p>{reviewIds.has(transaction.id) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Revisar pago</span>}</div>{transaction.petName && transaction.clientName && <p className="mt-1 text-sm text-muted-foreground">{transaction.clientName}</p>}<p className="mt-1 break-words text-sm">{transaction.items.map(item => `${item.quantity > 1 ? `${item.quantity} × ` : ""}${item.description}`).join(", ")}</p><p className="mt-2 text-xs text-muted-foreground">{formatTransactionDate(transaction.paidAt)} · {transaction.origin === "system_appointment_completed" ? "Servicio de cita" : transaction.origin === "manual_pos_sale" ? "Venta POS" : "Registro anterior"} · {reviewIds.has(transaction.id) ? "Método por confirmar" : PAYMENT_METHOD_LABELS[transaction.paymentMethod]}{transaction.recordedBy?.name ? ` · Registró: ${transaction.recordedBy.name}` : ""}</p></div><div className="flex flex-wrap items-center justify-between gap-3 md:justify-end"><strong className="text-lg tabular-nums">{formatPosMoney(transaction.total)}</strong>{reviewIds.has(transaction.id) ? <Button onClick={event => { reviewTrigger.current = event.currentTarget; setSelected(transaction); }}>Revisar pago</Button> : <Button variant="outline" onClick={() => setReceipt(transaction)}><ReceiptText className="mr-2 h-4 w-4" />Comprobante</Button>}</div></div>)}</div>
        {!data.total && <div className="py-9 text-center"><ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" /><h4 className="mt-3 font-semibold">Sin cobros con estos filtros</h4><p className="mt-1 text-sm text-muted-foreground">Revisa la búsqueda o consulta todos los movimientos.</p><Button className="mt-4" variant="outline" onClick={() => { setQuery(""); setFilter("all"); setPaymentFilter("all"); setPage(1); }}>Limpiar filtros</Button></div>}
      </>}
    </div>
    {data && <HistoryPages data={data} onPage={setPage} onSize={size => { setPageSize(size); setPage(1); }} />}
    {selected && <ReviewPaymentDialog key={selected.id} transaction={selected} initialAttempt={uncertain[selected.id]} onUncertainChange={attempt => setUncertain(previous => { const next = { ...previous }; if (attempt) next[selected.id] = attempt; else delete next[selected.id]; return next; })} onClose={() => setSelected(null)} onReturnFocus={() => { if (reviewTrigger.current?.isConnected && !reviewTrigger.current.disabled) reviewTrigger.current.focus(); else document.getElementById("cash-search")?.focus(); }} onSaved={() => { setSelected(null); setNotice("Método de pago confirmado. El importe del servicio se conserva."); load(); router.refresh(); }} />}
    <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />
  </section>;
}
