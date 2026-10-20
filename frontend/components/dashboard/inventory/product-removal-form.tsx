"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProtectedDialog, useDialogEditGuard } from "../protected-dialog";
import { FormDialogContent, FormDialogHeader, FormDialogBody, FormDialogFooter, FormField } from "../form-layout";
import { useFormFeedback } from "../form-feedback";
import { useInventoryFormOperation } from "./use-inventory-form-operation";
import { InventoryOperationStatus } from "./operation-status";
import type { InventoryProduct } from "@/lib/inventory";

type Props = { product: InventoryProduct; onClose: () => void; onSaved: () => void | Promise<void> };
function Editor({ product, onClose, onSaved }: Props) {
  const [reason, setReason] = useState(""), [saved, setSaved] = useState(false);
  const { operation, ownPending } = useInventoryFormOperation(() => setSaved(true), onSaved);
  const feedback = useFormFeedback();
  const close = useDialogEditGuard(!saved && !ownPending && !!reason, operation.busy);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saved || operation.busy || operation.pending.length || !operation.ready || !feedback.validate(event.currentTarget, {})) return;
    if (await operation.execute("remove_product", `/api/dashboard/inventory/products/${product.id}/removal`, { expectedVersion: product.metadataVersion, expectedStockRevision: product.stockRevision, reason: reason.trim() }, `Eliminar · ${product.name}`)) setSaved(true);
  }
  return <FormDialogContent className="max-w-lg">
    <FormDialogHeader><DialogTitle>Eliminar producto</DialogTitle><DialogDescription>{product.name} · {product.internalCode}</DialogDescription></FormDialogHeader>
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <FormDialogBody>
        <InventoryOperationStatus operation={operation} focusFeedback />
        <p className="text-sm text-muted-foreground">Se retirará del catálogo y podrás registrar de nuevo su código. Su historial se conserva. Solo se permite si no tiene existencias, ventas ni consumos.</p>
        {saved ? <p className="text-sm text-teal-900">Producto eliminado del catálogo.</p> : <FormField id="product-removal-reason" label="Motivo" error={feedback.errors["product-removal-reason"]}><textarea id="product-removal-reason" required maxLength={1000} rows={3} {...feedback.fieldProps("product-removal-reason")} value={reason} disabled={operation.busy || ownPending} onChange={e => { setReason(e.target.value); feedback.clearField("product-removal-reason"); }} className="w-full rounded-xl border p-3" placeholder="Ej. Producto registrado por error" /></FormField>}
      </FormDialogBody>
      <FormDialogFooter><Button type="button" variant="outline" disabled={operation.busy} onClick={() => close(onClose)}>{saved || ownPending ? "Cerrar" : "Cancelar"}</Button>{!saved && <Button type="submit" variant="destructive" disabled={operation.busy || operation.pending.length > 0 || !operation.ready}>Eliminar producto</Button>}</FormDialogFooter>
    </form>
  </FormDialogContent>;
}
export function ProductRemovalForm(props: Props) {
  return <ProtectedDialog open onOpenChange={open => { if (!open) props.onClose(); }}><Editor {...props} /></ProtectedDialog>;
}
