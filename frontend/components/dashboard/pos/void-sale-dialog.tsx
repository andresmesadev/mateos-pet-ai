"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormDialogBody, FormDialogContent, FormDialogFooter, FormDialogHeader, FormField, FormSection } from "../form-layout";
import { useFormFeedback } from "../form-feedback";
import { ProtectedDialog, useDialogEditGuard } from "../protected-dialog";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { formatPosMoney } from "@/lib/pos-checkout";
import { isHistoryTransaction, inventoryReturnProgress } from "@/lib/pos-history";
import { formatTransactionDate, type Transaction } from "@/lib/transactions";

type Props = { transaction: Transaction; initiallyUncertain: boolean; onUncertainChange: (value: boolean) => void; onClose: () => void; onConfirmed: (row: Transaction) => void; onReturnFocus: () => void };

export function VoidSaleDialog(props: Props) {
  return <ProtectedDialog open onOpenChange={open => { if (!open) props.onClose(); }}><VoidSaleEditor {...props} /></ProtectedDialog>;
}

function VoidSaleEditor({ transaction, initiallyUncertain, onUncertainChange, onClose, onConfirmed, onReturnFocus }: Props) {
  const tenant = useTenant();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertainState] = useState(initiallyUncertain);
  function setUncertain(value: boolean) { setUncertainState(value); onUncertainChange(value); }
  const [error, setError] = useState(initiallyUncertain ? "Hay una anulación sin confirmar. Comprueba el estado antes de repetirla." : "");
  const [result, setResult] = useState<Transaction | null>(null);
  const busy = useRef(false);
  const feedback = useFormFeedback();
  const close = useDialogEditGuard(!!reason.trim() && !uncertain && !result, saving);
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
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || uncertain || result) return;
    if (!feedback.validate(event.currentTarget, { "sale-void-reason": "Escribe el motivo de la anulación." })) return;
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
  return <FormDialogContent showClose={!saving} onCloseAutoFocus={event => { event.preventDefault(); onReturnFocus(); }} className="border-border bg-white">
    <FormDialogHeader><DialogTitle>{result ? "Venta anulada" : "Anular venta manual"}</DialogTitle><DialogDescription>{result ? "El registro y su importe original se conservan como antecedente." : "La venta dejará de sumar a los ingresos. Un día con cierre oficial no permite esta anulación."}</DialogDescription></FormDialogHeader>
    <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col"><FormDialogBody>
      <div className="rounded-xl bg-muted/30 p-4"><p className="break-words font-semibold">{transaction.clientName || transaction.clientPhone || "Venta de mostrador"}{transaction.petName ? ` · ${transaction.petName}` : ""}</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatPosMoney(transaction.total)}</p><p className="mt-2 break-all text-xs text-muted-foreground">Ref. {transaction.id}</p></div>
      {result ? <div role="status"><p className="text-sm font-semibold">Motivo guardado</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{result.voidReason}</p><p className="mt-2 text-xs text-muted-foreground">{formatTransactionDate(result.voidedAt!)}</p>{pendingProducts.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{pendingProducts.length === 1 ? "Queda 1 línea" : `Quedan ${pendingProducts.length} líneas`} de productos por recibir. Cierra este diálogo y utiliza Recibir devolución cuando tengas la mercancía.</p>}</div> : <FormSection title="Motivo de la anulación" description="Este motivo se conservará junto al registro original."><FormField id="sale-void-reason" label="Motivo (obligatorio)" error={feedback.errors["sale-void-reason"]}><textarea id="sale-void-reason" {...feedback.fieldProps("sale-void-reason")} required maxLength={1000} rows={3} disabled={saving || uncertain} value={reason} onChange={event => { setReason(event.target.value); setError(""); feedback.clearField("sale-void-reason"); }} className="w-full rounded-lg border p-3 text-sm focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60" placeholder="Explica por qué se anula esta venta" /></FormField></FormSection>}
      <p className="text-xs text-muted-foreground">Anular no realiza un reembolso bancario ni repone productos. La recepción de mercancía se registra por separado.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </FormDialogBody><FormDialogFooter className="sm:flex-wrap">{result ? <Button type="button" onClick={() => close(onClose)}>Cerrar</Button> : <><Button type="button" variant="outline" disabled={saving} onClick={() => close(onClose)}>{uncertain ? "Cerrar y comprobar después" : "Conservar venta"}</Button>{uncertain ? <Button type="button" variant="outline" disabled={saving} onClick={verify}>{saving ? "Comprobando…" : "Comprobar anulación"}</Button> : <Button type="submit" variant="destructive" disabled={saving}>{saving ? "Anulando…" : "Confirmar anulación"}</Button>}</>}</FormDialogFooter></form>
  </FormDialogContent>;
}
