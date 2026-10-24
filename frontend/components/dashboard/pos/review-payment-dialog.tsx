"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { proxyUrl } from "@/lib/api";
import { cashChange, formatPosMoney, moneyInCents, mixedPaymentIssue } from "@/lib/pos-checkout";
import { MixedPaymentFields } from './mixed-payment-fields';
import { PAYMENT_METHOD_LABELS, type PaymentMethod, type Transaction } from "@/lib/transactions";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { FormAdditional, FormDialogBody, FormDialogContent, FormDialogFooter, FormDialogHeader, FormField, FormSection } from "../form-layout";
import { FormSubmissionError, useFormFeedback } from "../form-feedback";
import { ProtectedDialog, useDialogEditGuard } from "../protected-dialog";
import { dashboardRequest } from "@/lib/dashboard-request";
import { isHistoryTransaction, transactionNeedsReview } from "@/lib/pos-history";

export type PaymentAttempt = { paymentMethod: PaymentMethod; cashAmount?: number; transferAmount?: number; notes: string | null };
const matchesAttempt = (value: Transaction, attempt: PaymentAttempt) => value.paymentMethod === attempt.paymentMethod && (value.notes ?? null) === attempt.notes && (attempt.paymentMethod !== 'mixed' || (value.cashAmount === attempt.cashAmount && value.transferAmount === attempt.transferAmount));
type Props = { transaction: Transaction; onClose: () => void; onSaved: () => void; onReturnFocus: () => void; initialAttempt?: PaymentAttempt; onUncertainChange?: (attempt: PaymentAttempt | undefined) => void };

export function ReviewPaymentDialog(props: Props) {
  const { onClose } = props;
  return <ProtectedDialog open onOpenChange={open => { if (!open) onClose(); }}>
    <PaymentEditor {...props} />
  </ProtectedDialog>;
}

function PaymentEditor({ transaction, onClose, onSaved, onReturnFocus, initialAttempt, onUncertainChange }: Props) {
  const tenant = useTenant();
  const [method, setMethod] = useState<PaymentMethod>(initialAttempt?.paymentMethod ?? transaction.paymentMethod);
  const [received, setReceived] = useState("");
  const [cashAmount, setCashAmount] = useState(String(initialAttempt?.cashAmount ?? transaction.cashAmount ?? ''));
  const [transferAmount, setTransferAmount] = useState(String(initialAttempt?.transferAmount ?? transaction.transferAmount ?? ''));
  const [notes, setNotes] = useState(initialAttempt ? initialAttempt.notes ?? "" : transaction.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState<PaymentAttempt | undefined>(initialAttempt);
  const busy = useRef(false);
  const feedback = useFormFeedback();
  const close = useDialogEditGuard(method !== transaction.paymentMethod || !!received || !!cashAmount || !!transferAmount || notes !== (transaction.notes ?? ""), saving);
  const usesCash = method === 'cash' || method === 'mixed';
  const cashDue = method === 'mixed' ? moneyInCents(cashAmount) ?? 0 : Math.round(transaction.total * 100);
  const change = cashChange(cashDue, received);
  const url = proxyUrl(`/api/dashboard/transactions/${encodeURIComponent(transaction.id)}` + tenantQuery(tenant));
  function valid(value: unknown): value is Transaction {
    return isHistoryTransaction(value) && value.id === transaction.id && value.origin === transaction.origin && value.status === "active" &&
      value.appointmentId === transaction.appointmentId && Math.round(value.total * 100) === Math.round(transaction.total * 100);
  }
  function uncertain(value: PaymentAttempt | undefined) { setAttempt(value); onUncertainChange?.(value); }
  async function checkResult() {
    if (busy.current || !attempt) return;
    busy.current = true; setSaving(true); feedback.clear();
    try {
      const { response, payload } = await dashboardRequest(url, { cache: "no-store" });
      if (!response.ok || !valid(payload)) throw new Error("No se pudo comprobar el cobro. Conservamos los datos; vuelve a comprobar.");
      if (!transactionNeedsReview(payload)) {
        if (!matchesAttempt(payload, attempt)) throw new Error("El cobro fue revisado con otros datos. Cierra y actualiza Caja antes de continuar.");
        uncertain(undefined); onSaved();
      } else {
        uncertain(undefined);
        feedback.setSubmitError("El cobro aún figura por revisar. Comprueba el pago recibido antes de volver a confirmar.");
      }
    } catch (cause) { feedback.setSubmitError(cause instanceof Error ? cause.message : "No se pudo comprobar el resultado. Conservamos los datos."); }
    finally { busy.current = false; setSaving(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || attempt) return;
    if (method === 'mixed') { const issue = mixedPaymentIssue(Math.round(transaction.total * 100), cashAmount, transferAmount); if (issue) { feedback.setSubmitError(issue); return; } }
    const cashError: Record<string, string> = usesCash && (!change || change.missing > 0)
      ? { "payment-received": "Ingresa el efectivo recibido; debe cubrir la parte en efectivo del cobro." } : {};
    if (!feedback.validate(event.currentTarget, {}, cashError)) return;
    busy.current = true; setSaving(true);
    const intended: PaymentAttempt = { paymentMethod: method, notes: notes.trim() || null, ...(method === 'mixed' ? { cashAmount: moneyInCents(cashAmount)! / 100, transferAmount: moneyInCents(transferAmount)! / 100 } : {}) };
    let sent = false;
    try {
      const current = await dashboardRequest(url, { cache: "no-store" });
      if (!current.response.ok || !valid(current.payload)) throw new Error("No se pudo consultar el cobro. Conservamos los datos; intenta de nuevo.");
      if (!transactionNeedsReview(current.payload)) {
        if (matchesAttempt(current.payload, intended)) { onSaved(); return; }
        throw new Error("El cobro ya fue revisado. Cierra y actualiza Caja para consultar los datos actuales.");
      }
      sent = true;
      const { response, payload } = await dashboardRequest(proxyUrl(`/api/dashboard/transactions/${encodeURIComponent(transaction.id)}/settle` + tenantQuery(tenant)), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intended),
      });
      if (!response.ok) {
        if (response.status < 500) sent = false;
        throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "No se pudo guardar la revisión del pago.");
      }
      if (!valid(payload) || transactionNeedsReview(payload) || !matchesAttempt(payload, intended)) throw new Error("La respuesta no confirma los datos guardados. Comprueba el resultado.");
      uncertain(undefined);
      onSaved();
    } catch (cause) {
      if (sent) uncertain(intended);
      feedback.setSubmitError(cause instanceof Error ? cause.message : "No se pudo confirmar el resultado. Actualiza Caja para revisar los datos guardados.");
    } finally { busy.current = false; setSaving(false); }
  }

  return <FormDialogContent showClose={!saving} onCloseAutoFocus={event => { event.preventDefault(); onReturnFocus(); }} className="border-border bg-white">
    <FormDialogHeader><DialogTitle>{transaction.paymentStatus === 'pending' ? 'Registrar pago de la atención' : 'Revisar el pago del servicio'}</DialogTitle><DialogDescription>{transaction.paymentStatus === 'pending' ? 'Confirma el dinero recibido. El pago se registrará en Caja con la fecha actual y el importe de esta atención.' : 'Confirma el método de pago. El importe y la fecha anteriores se conservan; esta acción no crea otro cobro.'}</DialogDescription></FormDialogHeader>
    <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
      <FormDialogBody>
        <div className="min-w-0 rounded-xl bg-muted p-4"><p className="break-words font-semibold">{transaction.petName || transaction.clientName || "Servicio"}</p><p className="mt-1 break-words text-sm text-muted-foreground">{transaction.items.map(item => item.description).join(", ")}</p><p className="mt-3 break-words text-2xl font-bold tabular-nums">{formatPosMoney(transaction.total)}</p></div>
        <fieldset disabled={saving || !!attempt} className="min-w-0 space-y-6">
          <FormSection title="Datos del pago" description="Verifica que recibiste el pago antes de confirmar.">
            <FormField id="payment-method" label="Método de pago">
              <select id="payment-method" className="h-11 w-full rounded-xl border bg-white px-3 text-sm" value={method} onChange={event => { setMethod(event.target.value as PaymentMethod); feedback.clear(); }}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </FormField>
            {method === 'mixed' && <MixedPaymentFields totalCents={Math.round(transaction.total * 100)} cash={cashAmount} transfer={transferAmount} onCash={setCashAmount} onTransfer={setTransferAmount} />}
            {usesCash && <>
              <FormField id="payment-received" label="Efectivo recibido (COP)" hint="Sin separadores de miles. Ejemplo: 100000." error={feedback.errors["payment-received"]}>
                <Input id="payment-received" inputMode="decimal" maxLength={11} value={received} {...feedback.fieldProps("payment-received", true)} onChange={event => { setReceived(event.target.value); feedback.clearField("payment-received"); }} placeholder="Ej. 100000" />
                <Button type="button" variant="outline" className="min-h-11 w-full whitespace-normal" onClick={() => { setReceived(String(cashDue / 100)); feedback.clearField("payment-received"); }}>Recibí el valor exacto</Button>
              </FormField>
              <p role="status" aria-live="polite" className="flex flex-wrap justify-between gap-2 rounded-xl bg-muted p-3 text-sm"><span>{change?.missing ? "Falta por recibir" : "Cambio"}</span><strong>{formatPosMoney(change?.missing || change?.change || 0)}</strong></p>
            </>}
          </FormSection>
          <FormAdditional><FormField id="payment-notes" label="Nota del cobro" optional error={feedback.errors["payment-notes"]}>
            <textarea id="payment-notes" maxLength={2000} rows={3} {...feedback.fieldProps("payment-notes")} className="block w-full rounded-xl border p-3 text-sm focus-visible:outline-2 focus-visible:outline-primary" value={notes} onChange={event => { setNotes(event.target.value); feedback.clearField("payment-notes"); }} />
          </FormField></FormAdditional>
        </fieldset>
        <FormSubmissionError message={feedback.submitError} />
        {attempt && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">El resultado está por comprobar. Conservamos el método y la nota; consulta el cobro antes de volver a enviarlos.</p>}
      </FormDialogBody>
      <FormDialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => close(onClose)}>Cerrar</Button>{attempt ? <Button type="button" disabled={saving} onClick={() => void checkResult()}>{saving ? "Comprobando…" : "Comprobar resultado"}</Button> : <Button type="submit" disabled={saving}>{saving ? "Guardando…" : transaction.paymentStatus === 'pending' ? "Confirmar pago recibido" : "Confirmar método de pago"}</Button>}</FormDialogFooter>
    </form>
  </FormDialogContent>;
}
