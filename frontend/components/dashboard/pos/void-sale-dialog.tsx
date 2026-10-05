"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { formatPosMoney } from "@/lib/pos-checkout";
import { isHistoryTransaction, inventoryReturnProgress } from "@/lib/pos-history";
import { formatTransactionDate, type Transaction } from "@/lib/transactions";

export function VoidSaleDialog({ transaction, initiallyUncertain, onUncertainChange, onClose, onConfirmed }: { transaction: Transaction; initiallyUncertain: boolean; onUncertainChange: (value: boolean) => void; onClose: () => void; onConfirmed: (row: Transaction) => void }) {
  const tenant = useTenant();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertainState] = useState(initiallyUncertain);
  function setUncertain(value: boolean) { setUncertainState(value); onUncertainChange(value); }
  const [error, setError] = useState(initiallyUncertain ? "Hay una anulación sin confirmar. Comprueba el estado antes de repetirla." : "");
  const [result, setResult] = useState<Transaction | null>(null);
  const busy = useRef(false);
  const endpoint = `/api/dashboard/transactions/${encodeURIComponent(transaction.id)}`;
  function confirmed(value: unknown) {
    if (!isHistoryTransaction(value) || value.id !== transaction.id || value.status !== "voided" ||
      Math.round(value.total * 100) !== Math.round(transaction.total * 100) || !value.voidReason || !value.voidedAt || !Number.isFinite(Date.parse(value.voidedAt))) return false;
    setResult(value); setUncertain(false); setError(""); onConfirmed(value); return true;
  }
  async function verify() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(proxyUrl(`${endpoint}${tenantQuery(tenant)}`), { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const row: unknown = await response.json();
      if (!response.ok) throw new Error();
      if (!confirmed(row)) {
        if (!isHistoryTransaction(row) || row.id !== transaction.id || row.status !== "active") throw new Error();
        setUncertain(false); setError("La venta sigue activa. Revisa el motivo antes de solicitar su anulación de nuevo.");
      }
    } catch { setError("No se pudo comprobar el estado. Vuelve a consultar antes de repetir la anulación."); }
    finally { busy.current = false; setSaving(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || uncertain || result) return;
    if (!reason.trim()) { setError("Escribe el motivo de la anulación."); return; }
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(proxyUrl(`${endpoint}/void${tenantQuery(tenant)}`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }), signal: AbortSignal.timeout(20_000) });
      const row = await response.json().catch(() => null);
      if (!response.ok && [400, 401, 403, 404, 409, 422].includes(response.status)) {
        setError(row?.error || "No se pudo anular la venta. Revisa tus permisos y si el día tiene cierre oficial.");
        if (response.status === 409) setUncertain(true);
        return;
      }
      if (!response.ok || !confirmed(row)) throw new Error();
    } catch { setUncertain(true); setError("No pudimos confirmar la anulación. Comprueba su estado antes de repetirla."); }
    finally { busy.current = false; setSaving(false); }
  }
  const pendingProducts = inventoryReturnProgress(result || transaction).pending;
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent showClose={!saving} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto border-border bg-white" onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} onPointerDownOutside={event => { if (saving) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>{result ? "Venta anulada" : "Anular venta manual"}</DialogTitle><DialogDescription>{result ? "El registro y su importe original se conservan como antecedente." : "La venta dejará de sumar a los ingresos. Un día con cierre oficial no permite esta anulación."}</DialogDescription></DialogHeader>
    <form noValidate onSubmit={submit}><div className="space-y-4 px-6 py-5">
      <div className="rounded-xl bg-muted/30 p-4"><p className="break-words font-semibold">{transaction.clientName || transaction.clientPhone || "Venta de mostrador"}{transaction.petName ? ` · ${transaction.petName}` : ""}</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatPosMoney(transaction.total)}</p><p className="mt-2 break-all text-xs text-muted-foreground">Ref. {transaction.id}</p></div>
      {result ? <div role="status"><p className="text-sm font-semibold">Motivo guardado</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{result.voidReason}</p><p className="mt-2 text-xs text-muted-foreground">{formatTransactionDate(result.voidedAt!)}</p>{pendingProducts.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{pendingProducts.length === 1 ? "Queda 1 línea" : `Quedan ${pendingProducts.length} líneas`} de productos por recibir. Cierra este diálogo y utiliza Recibir devolución cuando tengas la mercancía.</p>}</div> : <div><label htmlFor="sale-void-reason" className="mb-2 block text-sm font-medium">Motivo de la anulación (obligatorio)</label><textarea id="sale-void-reason" required maxLength={1000} rows={3} disabled={saving || uncertain} value={reason} onChange={event => { setReason(event.target.value); setError(""); }} className="w-full rounded-lg border p-3 text-sm focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60" placeholder="Explica por qué se anula esta venta" /></div>}
      <p className="text-xs text-muted-foreground">Anular no realiza un reembolso bancario ni repone productos. La recepción de mercancía se registra por separado.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div><DialogFooter className="flex-wrap">{result ? <Button type="button" onClick={onClose}>Cerrar</Button> : <><Button type="button" variant="outline" disabled={saving} onClick={onClose}>{uncertain ? "Cerrar y comprobar después" : "Conservar venta"}</Button>{uncertain ? <Button type="button" variant="outline" disabled={saving} onClick={verify}>{saving ? "Comprobando…" : "Comprobar anulación"}</Button> : <Button type="submit" variant="destructive" disabled={saving}>{saving ? "Anulando…" : "Confirmar anulación"}</Button>}</>}</DialogFooter></form>
  </DialogContent></Dialog>;
}
