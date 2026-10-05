"use client";

import { useState } from "react";
import { History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/lib/use-tenant";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/expenses";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/transactions";
import { formatPosMoney } from "@/lib/pos-checkout";
import { validHistoryRange } from "@/lib/pos-history";
import { isExpenseHistoryRow } from "@/lib/expense-history";
import { type ReportDetail } from "@/lib/pos-reports";
import { useFinancialHistory } from "./use-financial-history";
import { HistoryPages } from "./history-pages";

const selectClass = "mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm";
const dateLabel = (date: string) => new Date(date).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });

export function ExpenseHistory({ reportDetail }: { reportDetail?: ReportDetail }) {
  const tenant = useTenant();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const initial = reportDetail ? { from: reportDetail.from, to: reportDetail.to } : { from: `${today.slice(0, 7)}-01`, to: today };
  const lastAllowed = reportDetail && reportDetail.to > today ? reportDetail.to : today;
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [range, setRange] = useState(initial);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "all">("all");
  const [status, setStatus] = useState<"all" | "active" | "voided">(reportDetail ? "active" : "all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rangeError, setRangeError] = useState("");
  const params = new URLSearchParams({ ...range, pagination: "1", page: String(page), pageSize: String(pageSize), search: query, category, status });
  if (tenant) params.set("tenantId", tenant);
  const { data, loading, error: failed } = useFinancialHistory("expenses", params, revision, isExpenseHistoryRow);
  const error = failed ? "No se pudieron consultar los gastos. Intenta de nuevo." : "";

  function consult(event: React.FormEvent) {
    event.preventDefault();
    if (!validHistoryRange(from, to) || to > lastAllowed) {
      setRangeError(`Selecciona fechas válidas hasta ${lastAllowed}. La fecha inicial debe ser anterior o igual a la final.`); return;
    }
    setRangeError(""); setRange({ from, to }); setPage(1); setRevision(value => value + 1);
  }
  const visible = data?.data ?? [];
  const total = data?.total ?? 0;
  const activeTotal = data?.summary.activeTotal ?? 0;

  return <section aria-label="Consultar gastos" className="overflow-hidden rounded-2xl border bg-white">
    <header className="border-b p-5 sm:p-6"><h3 className="flex items-center gap-2 font-semibold"><History className="h-5 w-5 text-primary" />Consulta de gastos</h3><p className="mt-1 text-sm text-muted-foreground">Revisa gastos anteriores y el motivo de sus anulaciones. Fechas y horas de Bogotá.</p></header>
    <div className="space-y-4 border-b p-5 sm:p-6">
      <form noValidate onSubmit={consult} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1"><label htmlFor="expense-history-from" className="mb-2 block text-sm font-medium">Desde</label><Input id="expense-history-from" type="date" max={lastAllowed} value={from} onChange={event => setFrom(event.target.value)} /></div>
        <div className="min-w-0 flex-1"><label htmlFor="expense-history-to" className="mb-2 block text-sm font-medium">Hasta</label><Input id="expense-history-to" type="date" max={lastAllowed} value={to} onChange={event => setTo(event.target.value)} /></div>
        <Button type="submit" disabled={loading}><Search />{loading ? "Consultando…" : "Consultar gastos"}</Button>
      </form>
      {rangeError && <p role="alert" className="text-sm text-destructive">{rangeError}</p>}
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <div><label htmlFor="expense-history-search" className="mb-2 block text-sm font-medium">Buscar por descripción o responsable</label><Input id="expense-history-search" type="search" placeholder="Ej. Champú o Ana García" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></div>
        <label className="text-sm font-medium">Categoría<select className={selectClass} value={category} onChange={event => { setCategory(event.target.value as ExpenseCategory | "all"); setPage(1); }}><option value="all">Todas las categorías</option>{Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-medium">Estado<select className={selectClass} value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); }}><option value="all">Activos y anulados</option><option value="active">Activos</option><option value="voided">Anulados</option></select></label>
      </div>
      {(query || category !== "all" || status !== "all") && <Button type="button" variant="outline" onClick={() => { setQuery(""); setCategory("all"); setStatus("all"); setPage(1); }}>Limpiar filtros</Button>}
    </div>
    {loading ? <p role="status" className="p-6 text-sm text-muted-foreground">Consultando registros…</p> : error ? <div role="alert" className="space-y-3 p-6"><p className="text-sm text-destructive">{error}</p><Button type="button" variant="outline" onClick={() => setRevision(value => value + 1)}>Reintentar</Button></div> : <>
      <div role="status" className="space-y-2 border-b bg-muted/20 px-5 py-4 text-sm"><p>{total} {total === 1 ? "registro encontrado" : "registros encontrados"} · Gastos activos del período: <strong>{formatPosMoney(activeTotal)}</strong></p><p className="text-xs text-muted-foreground">Período consultado: {range.from} al {range.to}. El total incluye todas las páginas con los filtros aplicados. Los anulados no suman.</p></div>
      {!visible.length ? <div className="p-8 text-center"><p className="font-semibold">No hay gastos con estos criterios</p><p className="mt-1 text-sm text-muted-foreground">Prueba con otras fechas o limpia los filtros.</p></div> : <ul className="divide-y">{visible.map(row => <li key={row.id} className="space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="break-words font-semibold">{row.description}</p><p className="mt-1 text-sm text-muted-foreground">{dateLabel(row.date)}</p></div><div className="space-y-1 text-right"><p className={`font-semibold tabular-nums ${row.status === "voided" ? "text-muted-foreground" : "text-rose-700"}`}>{formatPosMoney(row.amount)}</p><span className={`inline-block rounded-full px-2 py-0.5 text-xs ${row.status === "voided" ? "bg-slate-100 text-slate-600" : "bg-teal-50 text-teal-800"}`}>{row.status === "voided" ? "Anulado" : "Activo"}</span></div></div>
        <p className="break-words text-sm text-muted-foreground">{EXPENSE_CATEGORY_LABELS[row.category] ?? row.category} · {PAYMENT_METHOD_LABELS[row.paymentMethod as PaymentMethod] ?? row.paymentMethod} · Responsable: {row.responsible || "No registrado"}</p>
        {row.status === "voided" && <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs font-semibold">Motivo de anulación</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{row.voidReason || "No registrado"}</p>{row.voidedAt && <p className="mt-2 text-xs text-muted-foreground">Anulado: {dateLabel(row.voidedAt)}</p>}</div>}
        <details><summary className="cursor-pointer text-xs font-semibold text-primary">Ver notas y referencia</summary>{row.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.notes}</p>}<p className="mt-2 break-all text-xs text-muted-foreground">Registro: {row.id}</p></details>
      </li>)}</ul>}
      {data && <HistoryPages data={data} onPage={setPage} onSize={size => { setPageSize(size); setPage(1); }} />}
    </>}
  </section>;
}
