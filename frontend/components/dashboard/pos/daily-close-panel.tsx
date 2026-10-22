"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDashboardAccess } from "../dashboard-access-provider";
import { proxyUrl } from "@/lib/api";
import { formatPosMoney } from "@/lib/pos-checkout";
import { aggregateCommissions, commissionPeriod, type CloseDay, type CommissionPeriod } from "@/lib/daily-close";
import { cashAmountValid, readCashOpening, type CashOpeningState } from '@/lib/cash-opening';

export function DailyClosePanel({ date, tenant }: { date: string; tenant?: string }) {
  const access = useDashboardAccess();
  const router = useRouter();
  const [day, setDay] = useState<CloseDay | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reload, setReload] = useState(0);
  const [cash, setCash] = useState<CashOpeningState | null>(null);
  const [retained, setRetained] = useState('');
  useEffect(() => { const refresh = () => setReload(value => value + 1); window.addEventListener('cash-opening-updated', refresh); return () => window.removeEventListener('cash-opening-updated', refresh); }, []);
  const [names, setNames] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState<CommissionPeriod>("day");
  const [range, setRange] = useState(commissionPeriod(date, "day"));
  const [periodDays, setPeriodDays] = useState<CloseDay[]>([]);
  const [periodBusy, setPeriodBusy] = useState(false);
  const [periodError, setPeriodError] = useState("");
  const periodRequest = useRef(0);
  useEffect(() => { periodRequest.current++; }, [range.from, range.to]);
  const allowed = Boolean(access?.capabilities.administration);
  const scope = tenant ? `&tenantId=${encodeURIComponent(tenant)}` : "";
  const readDay = useCallback(async () => {
    const response = await fetch(proxyUrl(`/api/dashboard/financial-history?from=${date}&to=${date}${scope}`), { cache: "no-store" });
    const body = await response.json();
    if (!response.ok || body.days?.[0]?.date !== date) throw new Error(body.error ?? "No se pudo comprobar el cierre.");
    return body.days[0] as CloseDay;
  }, [date, scope]);
  useEffect(() => {
    if (!allowed) return;
    let current = true;
    void readDay().then(value => { if (current) { setDay(value); setError(""); } }).catch(cause => { if (current) setError(cause.message); });
    void fetch(proxyUrl(`/api/dashboard/cash/opening?date=${date}${scope}`), { cache: 'no-store' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'No se pudo consultar la base.'); return readCashOpening(body, date); }).then(value => { if (current) setCash(value); }).catch(cause => { if (current) { setCash(null); setError(cause.message); } });
    void fetch(proxyUrl(`/api/dashboard/staff${tenant ? `?tenantId=${encodeURIComponent(tenant)}` : ""}`), { cache: "no-store" })
      .then(async response => response.ok ? response.json() : []).then(rows => {
        if (current && Array.isArray(rows)) setNames(Object.fromEntries(rows.map(row => [row.id, row.name])));
      }).catch(() => {});
    return () => { current = false; };
  }, [allowed, date, tenant, reload, readDay, scope]);

  async function closeDay() {
    if (saving || !day || day.closed) return;
    if (!cash?.opening || !retained.trim() || !cashAmountValid(Number(retained))) { setError('Confirma la base e indica cuánto efectivo dejas para la siguiente jornada; 0 es válido.'); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/daily-close${tenant ? `?tenantId=${encodeURIComponent(tenant)}` : ""}`), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, retainedCashAmount: Number(retained), expectedOpeningCashAmount: cash.opening.amount }),
      });
      const body = await response.json();
      if (!response.ok && response.status !== 409) throw new Error(body.error ?? "No se pudo guardar el cierre.");
      const verified = await readDay();
      if (!verified.closed) throw new Error("No se pudo confirmar el cierre. Comprueba su estado antes de repetir.");
      setDay(verified); setConfirm(false); router.refresh(); window.dispatchEvent(new Event('cash-opening-updated'));
    } catch (cause) {
      // Recover an accepted close after a lost response; never create a second expense or commission.
      try {
        const verified = await readDay();
        if (verified.closed) { setDay(verified); setConfirm(false); router.refresh(); window.dispatchEvent(new Event('cash-opening-updated')); return; }
      } catch { /* Preserve the original error and offer a read-only retry. */ }
      setError(cause instanceof Error ? cause.message : "No se pudo comprobar el cierre.");
    } finally { setSaving(false); }
  }
  async function queryPeriod() {
    if (periodBusy) return;
    setPeriodBusy(true); setPeriodError(""); setPeriodDays([]);
    const request = ++periodRequest.current;
    try {
      const response = await fetch(proxyUrl(`/api/dashboard/financial-history?from=${range.from}&to=${range.to}${scope}`), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.days)) throw new Error(body.error ?? "No se pudo consultar el período.");
      if (request === periodRequest.current) setPeriodDays(body.days);
    } catch (cause) { if (request === periodRequest.current) setPeriodError(cause instanceof Error ? cause.message : "No se pudo consultar el período."); }
    finally { setPeriodBusy(false); }
  }
  if (!allowed) return null;
  const staffLabel = (id: string | null) => id ? names[id] ?? "Profesional" : "Sin asignar";
  const rows = aggregateCommissions(periodDays);
  return <section aria-label="Cierre del día y comisiones" className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Cierre del día y comisiones</h3><p className="mt-1 text-sm text-muted-foreground">{day?.closed ? "Cierre oficial guardado. Importes conservados de esta fecha." : "Revisa la jornada y guarda su cierre oficial."}</p></div><Button disabled={!day || day.closed || saving || !!error || !cash?.opening} onClick={() => setConfirm(true)}>{day?.closed ? "Día cerrado" : "Cerrar día"}</Button></div>
    {day && !day.closed && cash && !cash.opening && <p className="text-sm text-amber-800">Confirma primero el dinero base de esta jornada, incluso si es 0.</p>}
    {!day && !error && <p role="status" className="text-sm">Consultando cierre…</p>}
    {error && <div role="alert" className="space-y-2 text-sm text-red-800"><p>{error}</p><Button type="button" variant="outline" disabled={saving} onClick={() => setReload(value => value + 1)}>Comprobar estado del cierre</Button></div>}
    {day && <><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border bg-background p-4"><p className="text-sm">Parte de los profesionales generada en el día</p><strong className="mt-1 block text-xl tabular-nums">{formatPosMoney(day.staffCommissionTotal)}</strong></div><div className="rounded-lg border border-primary/20 bg-background p-4"><p className="text-sm font-semibold">Saldo tras reservar comisiones</p><strong className="mt-1 block text-2xl text-primary tabular-nums">{formatPosMoney(day.netAfterCommissions)}</strong><p className="mt-1 text-xs text-muted-foreground">Ingresos recibidos − gastos registrados − comisiones generadas</p></div></div>
      {day.staffBreakdown.length > 0 && <ul className="divide-y text-sm">{day.staffBreakdown.map(row => <li key={row.staffId ?? "unassigned"} className="flex flex-wrap justify-between gap-2 py-2"><span>{staffLabel(row.staffId)} · {row.count} servicios</span><strong>{formatPosMoney(row.staffShare)}</strong></li>)}</ul>}
      <p className="text-xs text-muted-foreground">La reserva se descuenta automáticamente del resultado. No registra una entrega de dinero al profesional ni sustituye la conciliación de sus pagos.</p>
    </>}
    <details className="border-t pt-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Consultar comisiones por período</summary><div className="mt-3 space-y-3"><div className="flex flex-wrap items-end gap-3"><label className="text-sm">Período<select aria-label="Período de comisiones" value={period} className="mt-1 block h-11 rounded-md border bg-background px-3" onChange={event => { const next = event.target.value as CommissionPeriod; setPeriod(next); setRange(commissionPeriod(date, next)); setPeriodDays([]); }}><option value="day">Diario</option><option value="week">Semanal</option><option value="fortnight">Quincenal</option><option value="month">Mensual</option></select></label><label className="text-sm">Desde<input aria-label="Comisiones desde" type="date" value={range.from} max={range.to} className="mt-1 block h-11 rounded-md border bg-background px-3" onChange={event => { setRange(value => ({ ...value, from: event.target.value })); setPeriodDays([]); }} /></label><label className="text-sm">Hasta<input aria-label="Comisiones hasta" type="date" value={range.to} min={range.from} max={date} className="mt-1 block h-11 rounded-md border bg-background px-3" onChange={event => { setRange(value => ({ ...value, to: event.target.value })); setPeriodDays([]); }} /></label><Button variant="outline" disabled={periodBusy || !range.from || !range.to || range.from > range.to} onClick={() => void queryPeriod()}>{periodBusy ? "Consultando…" : "Consultar comisiones"}</Button></div><p className="text-xs text-muted-foreground">Semana desde el lunes; quincena del 1 al 15 o desde el 16. Ajusta las fechas al acuerdo del profesional. Se consulta lo generado hasta la fecha seleccionada; no confirma pagos.</p>{periodError && <p role="alert" className="text-sm text-red-800">{periodError}</p>}{periodDays.length > 0 && <ul aria-label="Comisiones del período" className="divide-y text-sm">{rows.length ? rows.map(row => <li key={row.staffId ?? "unassigned"} className="flex justify-between gap-3 py-2"><span>{staffLabel(row.staffId)} · {row.count} servicios</span><strong>{formatPosMoney(row.staffShare)}</strong></li>) : <li>Sin comisiones en este período.</li>}</ul>}</div></details>
    <Dialog open={confirm} onOpenChange={value => { if (!saving) setConfirm(value); }}>
      <DialogContent className="flex max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-md flex-col overflow-hidden border-border bg-background shadow-xl">
        <DialogHeader className="shrink-0 border-border px-5 pb-4 pt-5 pr-12">
          <DialogTitle>Guardar cierre del día</DialogTitle>
          <DialogDescription className="mt-1 leading-relaxed">Revisa el resumen del {date.split("-").reverse().join("/")} antes de confirmar.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
          {day && <>
            {cash?.opening && <p className="text-sm">Base de efectivo registrada: <strong>{formatPosMoney(cash.opening.amount)}</strong>. No suma ingresos.</p>}
            <dl aria-label="Resumen del cierre" className="divide-y rounded-xl border bg-muted/20 px-4">
              <div className="flex items-start justify-between gap-3 py-3"><dt className="min-w-0 text-sm text-muted-foreground">Ingresos recibidos</dt><dd className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{formatPosMoney(day.incomeTotal)}</dd></div>
              <div className="flex items-start justify-between gap-3 py-3"><dt className="min-w-0 text-sm text-muted-foreground">Gastos registrados</dt><dd className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{formatPosMoney(day.expenseTotal)}</dd></div>
              <div className="flex items-start justify-between gap-3 py-3"><dt className="min-w-0 text-sm text-muted-foreground">Reserva de comisiones</dt><dd className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{formatPosMoney(day.staffCommissionTotal)}</dd></div>
            </dl>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-medium">Saldo tras reservar comisiones</p><strong className="mt-1 block text-2xl text-primary tabular-nums">{formatPosMoney(day.netAfterCommissions)}</strong></div>
          </>}
          <label className="block text-sm font-semibold">Efectivo que dejas para la siguiente jornada (COP)<input aria-label="Efectivo que dejas para la siguiente jornada (COP)" type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" required value={retained} disabled={saving} onChange={event => setRetained(event.target.value)} placeholder="Escribe el importe; 0 si no dejas efectivo" className="mt-2 h-11 w-full rounded-md border bg-background px-3 font-normal" /></label>
          <p className="text-xs text-muted-foreground">Registra solo efectivo que permanece en caja. Este valor se sugerirá como base al abrir la siguiente jornada; no se calcula desde transferencias ni reservas de comisiones.</p>
          <p className="text-xs leading-relaxed text-muted-foreground">El cierre es definitivo. Después de confirmarlo no podrás cambiar los movimientos financieros de esta jornada.</p>
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        </div>
        <DialogFooter className="grid shrink-0 grid-cols-1 gap-2 border-border px-5 py-4 sm:grid-cols-2">
          <Button className="h-auto min-h-11 w-full whitespace-normal px-3 py-3 text-sm" variant="outline" disabled={saving} onClick={() => setConfirm(false)}>Volver a revisar</Button>
          <Button className="h-auto min-h-11 w-full whitespace-normal px-3 py-3 text-sm" disabled={saving || !retained.trim() || !cashAmountValid(Number(retained))} onClick={() => void closeDay()}>{saving ? "Guardando…" : "Confirmar cierre del día"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
