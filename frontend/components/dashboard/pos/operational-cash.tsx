"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Loader2, ReceiptText, RefreshCw, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { proxyUrl } from "@/lib/api";
import { PAYMENT_METHOD_LABELS, formatTransactionDate, type PaymentMethod, type Transaction } from "@/lib/transactions";
import { cashChange, formatPosMoney } from "@/lib/pos-checkout";
import { getPetEmoji } from "@/lib/pets";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { ReceiptDialog } from "./sale-receipt";
import { filterCash, summarizeCash, type CashFilter, type CashMethod } from "@/lib/pos-cash";

type CashData = { date: string; transactions: Transaction[]; toReview: string[]; totalRegistered: number; hasMore: boolean };

export function OperationalCash() {
  const tenant = useTenant();
  const router = useRouter();
  const [data, setData] = useState<CashData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CashFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<CashMethod>("all");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [received, setReceived] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  const savingRef = useRef(false);
  const invalidate = useCallback(() => { ++request.current; }, []);
  const load = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    try {
      const response = await fetch(proxyUrl("/api/dashboard/cash/operational" + tenantQuery(tenant)), { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron cargar los cobros de hoy. Intenta de nuevo.");
      const payload = await response.json();
      if (version === request.current) { setData(payload); setError(""); }
    } catch (cause) { if (version === request.current) setError(cause instanceof Error ? cause.message : "No se pudo cargar Caja."); }
    finally { if (version === request.current) setLoading(false); }
  }, [tenant]);
  useEffect(() => { const timer = setTimeout(() => { setData(null); void load(); }, 0); return () => { clearTimeout(timer); invalidate(); }; }, [load, invalidate]);
  const change = selected ? cashChange(Math.round(selected.total * 100), received) : null;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || savingRef.current) return;
    if (method === "cash" && (!change || change.missing > 0)) { setSaveError("Ingresa el efectivo recibido; debe cubrir el importe del servicio."); return; }
    savingRef.current = true; setSaving(true); setSaveError("");
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/transactions/${encodeURIComponent(selected.id)}/settle` + tenantQuery(tenant)), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentMethod: method, notes: notes.trim() || null }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar la revisión del pago.");
      setSelected(null); setNotice("Método de pago confirmado. El importe del servicio se conserva."); await load(); router.refresh();
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : "No se pudo confirmar el resultado. Actualiza Caja para revisar los datos guardados."); }
    finally { savingRef.current = false; setSaving(false); }
  }
  const reviewIds = new Set(data?.toReview ?? []);
  const summary = summarizeCash(data?.transactions ?? [], reviewIds);
  const rows = filterCash(data?.transactions ?? [], reviewIds, query, filter, paymentFilter);
  const saleHref = `/dashboard/pos?tab=venta${tenant ? "&tenant=" + encodeURIComponent(tenant) : ""}`;
  return <section className="overflow-hidden rounded-2xl border bg-white">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-5 sm:px-6"><div><h3 className="flex items-center gap-2 text-lg font-bold"><Wallet className="h-5 w-5 text-primary" />Cobros de hoy</h3><p className="mt-1 text-sm text-muted-foreground">Ventas y servicios de la jornada · Horario de Bogotá</p></div><div className="flex flex-wrap gap-2"><Button asChild><Link href={saleHref}>Nuevo cobro</Link></Button><Button variant="outline" disabled={loading} onClick={() => { void load(); router.refresh(); }}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button></div></header>
    <div className="space-y-4 px-5 py-5 sm:px-6">
      {notice && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</p>}
      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p>{error}</p>{data && <p className="mt-1">Se muestran los últimos datos cargados. Actualiza antes de confirmar un pago.</p>}</div>}
      {!data && loading && <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando los movimientos de Caja…</p>}
      {data && <>
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><p>{new Date(data.date + "T12:00:00-05:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" })} · {data.transactions.length} movimientos{data.hasMore ? " en la lista visible" : ""}</p><p>Importe registrado: <strong className="text-foreground">{formatPosMoney(data.totalRegistered)}</strong></p></div>
        <dl className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {Object.entries(summary.methods).map(([key, value]) => <div key={key} className="min-w-0 rounded-xl border bg-muted/30 p-4"><dt className="text-sm font-medium">{PAYMENT_METHOD_LABELS[key as PaymentMethod]}</dt><dd className="mt-2 break-words text-xl font-bold tabular-nums">{formatPosMoney(value.cents / 100)}</dd><dd className="mt-1 text-xs text-muted-foreground">{value.count} con método confirmado</dd></div>)}
          <div className={`col-span-2 min-w-0 rounded-xl border p-4 xl:col-span-1 ${summary.reviewCount ? "border-amber-200 bg-amber-50 text-amber-950" : "bg-muted/30"}`}><dt className="text-sm font-medium">Por revisar</dt><dd className="mt-2 break-words text-xl font-bold tabular-nums">{formatPosMoney(summary.reviewCents / 100)}</dd><dd className="mt-1 text-xs">{summary.reviewCount} con método por confirmar</dd></div>
        </dl>
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]"><div><label htmlFor="cash-search" className="mb-2 block text-sm font-medium">Buscar un movimiento</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="cash-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cliente, mascota, artículo o número" className="pl-10" /></div></div><label className="text-sm font-medium">Medio de pago<select className="mt-2 block h-11 w-full rounded-xl border bg-white px-3 text-sm" value={paymentFilter} onChange={event => setPaymentFilter(event.target.value as CashMethod)}><option value="all">Todos los medios</option>{Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div role="group" aria-label="Filtrar movimientos" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">{([{ value: "all", label: "Todos", count: data.transactions.length }, { value: "review", label: "Por revisar", count: summary.reviewCount }, { value: "registered", label: "Método confirmado", count: data.transactions.length - summary.reviewCount }] as const).map(item => <button type="button" key={item.value} aria-pressed={filter === item.value} onClick={() => { setFilter(item.value); if (item.value === "review") setPaymentFilter("all"); }} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${filter === item.value ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:bg-white/60"}`}>{item.label} <span className="ml-1 text-xs">{item.count}</span></button>)}</div><p role="status" className="text-xs text-muted-foreground">{rows.length} resultados · {formatPosMoney(rows.reduce((sum, row) => sum + Math.round(row.total * 100), 0) / 100)} en este filtro</p></div>
        {data.toReview.length > 0 && <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" />Los servicios de citas completadas ya cuentan como ingresos. Revisa su método de pago para completar los datos; no registres otra venta por el mismo servicio.</p>}
        <div className="divide-y">{rows.map(transaction => <div key={transaction.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-words font-semibold">{transaction.petName ? `${getPetEmoji(transaction.petType ?? "")} ${transaction.petName}` : transaction.clientName || "Venta de mostrador"}</p>{reviewIds.has(transaction.id) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Revisar pago</span>}</div>{transaction.petName && transaction.clientName && <p className="mt-1 text-sm text-muted-foreground">{transaction.clientName}</p>}<p className="mt-1 break-words text-sm">{transaction.items.map(item => `${item.quantity > 1 ? `${item.quantity} × ` : ""}${item.description}`).join(", ")}</p><p className="mt-2 text-xs text-muted-foreground">{formatTransactionDate(transaction.paidAt)} · {transaction.origin === "system_appointment_completed" ? "Servicio de cita" : transaction.origin === "manual_pos_sale" ? "Venta POS" : "Registro anterior"} · {reviewIds.has(transaction.id) ? "Método por confirmar" : PAYMENT_METHOD_LABELS[transaction.paymentMethod]}{transaction.recordedBy?.name ? ` · Registró: ${transaction.recordedBy.name}` : ""}</p></div><div className="flex flex-wrap items-center justify-between gap-3 md:justify-end"><strong className="text-lg tabular-nums">{formatPosMoney(transaction.total)}</strong>{reviewIds.has(transaction.id) ? <Button disabled={loading || !!error} onClick={() => { setSelected(transaction); setMethod(transaction.paymentMethod); setNotes(transaction.notes ?? ""); setReceived(""); setSaveError(""); }}>Revisar pago</Button> : <Button variant="outline" onClick={() => setReceipt(transaction)}><ReceiptText className="mr-2 h-4 w-4" />Comprobante</Button>}</div></div>)}</div>
        {!rows.length && <div className="py-9 text-center"><ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" /><h4 className="mt-3 font-semibold">{data.transactions.length ? "No hay cobros con este filtro" : "Todavía no hay cobros hoy"}</h4><p className="mt-1 text-sm text-muted-foreground">{data.transactions.length ? "Prueba otra búsqueda o consulta todos los movimientos." : "Las ventas y los servicios terminados aparecerán aquí."}</p>{data.transactions.length ? <Button className="mt-4" variant="outline" onClick={() => { setQuery(""); setFilter("all"); setPaymentFilter("all"); }}>Ver todos</Button> : <Link href={saleHref} className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white">Crear una venta</Link>}</div>}
        {data.hasMore && <p className="text-xs text-muted-foreground">Se muestran hasta 200 movimientos. Los conteos, filtros y el importe corresponden a esta lista.</p>}
      </>}
    </div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !saving) setSelected(null); }}><DialogContent showClose={!saving} className="max-h-[90dvh] overflow-y-auto border-border bg-white shadow-xl"><DialogHeader><DialogTitle>Revisar el pago del servicio</DialogTitle><DialogDescription>Confirma el método de pago. El importe guardado se conserva y esta acción no crea otro cobro.</DialogDescription></DialogHeader>{selected && <form onSubmit={save} noValidate><fieldset disabled={saving} className="space-y-4 px-6 py-5"><div className="rounded-xl bg-muted p-4"><p className="font-semibold">{selected.petName || selected.clientName || "Servicio"}</p><p className="mt-1 text-sm text-muted-foreground">{selected.items.map(item => item.description).join(", ")}</p><p className="mt-3 text-2xl font-bold tabular-nums">{formatPosMoney(selected.total)}</p></div><label className="block text-sm font-semibold">Método de pago<select className="mt-2 block h-11 w-full rounded-xl border bg-white px-3 text-sm" value={method} onChange={event => { setMethod(event.target.value as PaymentMethod); setSaveError(""); }}>{Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{method === "cash" ? <div><label className="block text-sm font-semibold">Efectivo recibido (COP)<Input inputMode="decimal" value={received} onChange={event => { setReceived(event.target.value); setSaveError(""); }} placeholder="Ej. 100000" className="mt-2" /></label><button type="button" className="mt-2 text-xs font-semibold text-primary underline" onClick={() => { setReceived(String(selected.total)); setSaveError(""); }}>Recibí el valor exacto</button><p aria-live="polite" className="mt-3 flex justify-between rounded-xl bg-muted p-3 text-sm"><span>{change?.missing ? "Falta por recibir" : "Cambio"}</span><strong>{formatPosMoney(change?.missing || change?.change || 0)}</strong></p></div> : <p className="text-xs text-muted-foreground">Verifica que recibiste el pago antes de confirmar.</p>}<label className="block text-sm font-semibold">Nota del cobro (opcional)<textarea maxLength={2000} rows={2} className="mt-2 block w-full rounded-xl border p-3 text-sm" value={notes} onChange={event => setNotes(event.target.value)} /></label>{saveError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{saveError}</p>}</fieldset><DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setSelected(null)}>Cerrar</Button><Button disabled={saving}>{saving ? "Guardando…" : "Confirmar método de pago"}</Button></DialogFooter></form>}</DialogContent></Dialog>
    <ReceiptDialog transaction={receipt} onClose={() => setReceipt(null)} />
  </section>;
}
