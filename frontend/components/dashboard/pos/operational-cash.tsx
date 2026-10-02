"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";
import { formatCOP, PAYMENT_METHOD_LABELS, type PaymentMethod, type Transaction } from "@/lib/transactions";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
type CashData = { date: string; transactions: Transaction[]; toReview: string[]; totalRegistered: number; hasMore: boolean };
export function OperationalCash() {
  const [data, setData] = useState<CashData | null>(null), [error, setError] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null), [method, setMethod] = useState<PaymentMethod>("cash"), [notes, setNotes] = useState(""), [saving, setSaving] = useState(false);
  const tenant = useTenant();
  const load = useCallback(async () => {
    try {
      const response = await fetch(proxyUrl("/api/dashboard/cash/operational" + tenantQuery(tenant)), { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron cargar los movimientos de hoy");
      setData(await response.json()); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Intenta de nuevo"); }
  }, [tenant]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  async function save() {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(proxyUrl("/api/dashboard/transactions/" + selected.id + "/settle" + tenantQuery(tenant)), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentMethod: method, notes: notes.trim() || null }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo registrar el pago");
      setSelected(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar"); }
    finally { setSaving(false); }
  }
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5"><div><h2 className="text-lg font-bold">Movimientos de hoy</h2><p className="mt-1 text-sm text-muted-foreground">Revisa los cobros y confirma el método de pago de los servicios terminados.</p></div><Button variant="outline" onClick={() => void load()}>Actualizar</Button></div>
    {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{error}</p>}
    {!data ? <p role="status">Cargando Caja…</p> : <><p className="text-sm text-muted-foreground">{data.date} · {data.transactions.length} movimientos · {formatCOP(data.totalRegistered)} registrados{data.hasMore ? " · Mostrando los primeros 200" : ""}</p><div className="divide-y rounded-2xl border bg-white p-5">
      {data.transactions.length ? data.transactions.map(transaction => <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div><p className="font-semibold">{transaction.petName || transaction.clientName || "Venta de mostrador"}</p><p className="mt-1 text-sm text-muted-foreground">{transaction.items.map(item => item.description).join(", ")}</p><p className="mt-1 text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[transaction.paymentMethod]}{transaction.recordedBy?.name ? " · Registró: " + transaction.recordedBy.name : ""}</p></div>
        <div className="flex items-center gap-4"><span className="font-semibold">{formatCOP(transaction.total)}</span>{data.toReview.includes(transaction.id) && <Button size="sm" onClick={() => { setSelected(transaction); setMethod(transaction.paymentMethod); setNotes(transaction.notes ?? ""); }}>Confirmar pago</Button>}</div>
      </div>) : <p className="py-5 text-muted-foreground">Todavía no hay movimientos hoy.</p>}
    </div></>}
    {selected && <div role="dialog" aria-modal="true" aria-labelledby="confirm-payment-heading" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={event => { event.preventDefault(); void save(); }} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
      <h3 id="confirm-payment-heading" className="text-xl font-bold">Confirmar método de pago</h3><p>{selected.petName ?? selected.clientName} · {formatCOP(selected.total)}</p><p className="text-sm text-muted-foreground">El importe del servicio se conserva. Se guardará quién confirmó estos datos.</p>
      <label className="block space-y-2 text-sm font-semibold">Método de pago<select className="block w-full rounded-lg border p-3" value={method} onChange={event => setMethod(event.target.value as PaymentMethod)}>{Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="block space-y-2 text-sm font-semibold">Observación<textarea maxLength={2000} className="block w-full rounded-lg border p-3" value={notes} onChange={event => setNotes(event.target.value)} /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setSelected(null)}>Cerrar</Button><Button disabled={saving}>{saving ? "Guardando…" : "Guardar pago"}</Button></div>
    </form></div>}
  </section>;
}
