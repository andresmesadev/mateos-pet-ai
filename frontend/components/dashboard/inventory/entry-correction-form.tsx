"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProtectedDialog, useDialogEditGuard } from "../protected-dialog";
import { FormDialogContent, FormDialogHeader, FormDialogBody, FormDialogFooter, FormField, FormSection } from "../form-layout";
import { useFormFeedback } from "../form-feedback";
import { useInventoryFormOperation } from "./use-inventory-form-operation";
import { InventoryOperationStatus } from "./operation-status";
import type { InventoryMovement, InventoryProduct } from "@/lib/inventory";
import { formatPosMoney } from "@/lib/pos-checkout";

type Props = { product: InventoryProduct; source: InventoryMovement; onClose: () => void; onSaved: () => void | Promise<void> };
function Editor({ product, source, onClose, onSaved }: Props) {
  const [quantity, setQuantity] = useState(String(source.quantity));
  const [cost, setCost] = useState(String(source.entryUnitCost ?? "0"));
  const [reason, setReason] = useState(""), [saved, setSaved] = useState(false);
  const { operation, ownPending } = useInventoryFormOperation(() => setSaved(true), onSaved);
  const feedback = useFormFeedback();
  const close = useDialogEditGuard(!saved && !ownPending && (quantity !== String(source.quantity) || cost !== String(source.entryUnitCost ?? "0") || !!reason), operation.busy);
  const locked = saved || operation.busy || operation.pending.length > 0;
  const after = /^\d+$/.test(quantity) ? BigInt(product.physical) + BigInt(quantity) - BigInt(source.quantity) : null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || !operation.ready) return;
    const custom: Record<string, string> = /^\d{1,8}([.,]\d{1,2})?$/.test(cost.trim()) ? {} : { "entry-correction-cost": "Escribe pesos sin separadores de miles, con máximo dos decimales." };
    if (!feedback.validate(event.currentTarget, {}, custom)) return;
    if (await operation.execute("correct_entry", `/api/dashboard/inventory/products/${product.id}/entries/${source.id}/corrections`, { quantity: Number(quantity), unitCost: cost.trim().replace(",", "."), expectedStockRevision: product.stockRevision, reason: reason.trim() }, `Corregir entrada · ${product.name}`)) setSaved(true);
  }
  return <FormDialogContent className="max-w-xl">
    <FormDialogHeader><DialogTitle>Corregir entrada</DialogTitle><DialogDescription>{product.name} · {source.lotCodeSnapshot ?? "Sin lote"}</DialogDescription></FormDialogHeader>
    <form onSubmit={submit} noValidate aria-busy={operation.busy} className="flex min-h-0 flex-1 flex-col">
      <FormDialogBody>
        <InventoryOperationStatus operation={operation} focusFeedback />
        <p className="rounded-xl bg-muted/40 p-4 text-sm">Entrada original: <strong>{source.quantity} unidades</strong> a <strong>{formatPosMoney(Number(source.entryUnitCost ?? 0))}</strong> por unidad. El original se conservará junto con la corrección.</p>
        <fieldset disabled={locked} className="space-y-5">
          <FormSection title="Datos correctos de la entrada">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="entry-correction-quantity" label="Cantidad recibida correcta" error={feedback.errors["entry-correction-quantity"]} hint="Escribe 0 para cancelar esta entrada."><Input id="entry-correction-quantity" required type="number" min={0} max={2147483647} step={1} {...feedback.fieldProps("entry-correction-quantity")} value={quantity} onChange={e => { setQuantity(e.target.value); feedback.clearField("entry-correction-quantity"); }} /></FormField>
              <FormField id="entry-correction-cost" label="Costo unitario correcto (COP)" error={feedback.errors["entry-correction-cost"]}><Input id="entry-correction-cost" required inputMode="decimal" {...feedback.fieldProps("entry-correction-cost", true)} value={cost} onChange={e => { setCost(e.target.value); feedback.clearField("entry-correction-cost"); }} /></FormField>
            </div>
          </FormSection>
          <FormField id="entry-correction-reason" label="Motivo de la corrección" error={feedback.errors["entry-correction-reason"]}><textarea id="entry-correction-reason" required maxLength={1000} rows={3} {...feedback.fieldProps("entry-correction-reason")} value={reason} onChange={e => { setReason(e.target.value); feedback.clearField("entry-correction-reason"); }} className="w-full rounded-xl border p-3" placeholder="Ej. Se recibieron 8 unidades y se registraron 10" /></FormField>
        </fieldset>
        {saved ? <p className="text-sm text-teal-900">Corrección guardada. Cierra para consultar las existencias actualizadas.</p> : <div className="rounded-xl border bg-teal-50/40 p-4 text-sm"><p>Saldo físico: <strong>{product.physical}</strong> → <strong>{after !== null && after >= BigInt(0) ? after.toString() : "Revisar cantidad"} unidades</strong></p><p className="mt-2 text-muted-foreground">El lote y su vencimiento se conservan. Si ya hubo salidas del lote, revisa las existencias con Conteo físico.</p></div>}
      </FormDialogBody>
      <FormDialogFooter><Button type="button" variant="outline" disabled={operation.busy} onClick={() => close(onClose)}>{saved || ownPending ? "Cerrar" : "Cancelar"}</Button>{!saved && <Button type="submit" disabled={locked || !operation.ready}>{operation.busy ? "Guardando…" : "Guardar corrección"}</Button>}</FormDialogFooter>
    </form>
  </FormDialogContent>;
}
export function EntryCorrectionForm(props: Props) {
  return <ProtectedDialog open onOpenChange={open => { if (!open) props.onClose(); }}><Editor {...props} /></ProtectedDialog>;
}
