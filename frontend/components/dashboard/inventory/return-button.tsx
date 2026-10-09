"use client";
import { useState } from "react";
import { Undo2 } from "lucide-react";
import { useDashboardAccess } from "../dashboard-access-provider";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProtectedDialog, useDialogEditGuard } from "../protected-dialog";
import { FormDialogContent, FormDialogHeader, FormDialogBody, FormDialogFooter, FormSection, FormField } from "../form-layout";
import { FieldError, useFormFeedback } from "../form-feedback";
import type { Transaction } from "@/lib/transactions";
import { InventoryOperationStatus } from "./operation-status";
import { useInventoryFormOperation } from "./use-inventory-form-operation";

export function InventoryReturnButton({ transaction, onSaved }: { transaction: Transaction; onSaved: () => void | Promise<void> }) {
  const access = useDashboardAccess(), [open, setOpen] = useState(false);
  if (!access?.capabilities.inventory_manage || transaction.status !== "voided" || transaction.origin !== "manual_pos_sale" || !transaction.items.some(i => i.productId && !i.inventoryReturn)) return null;
  return <><Button variant="outline" onClick={() => setOpen(true)}><Undo2 className="mr-2 h-4 w-4" />Recibir devolución</Button>{open && <ProtectedDialog open onOpenChange={v => { if (!v) setOpen(false); }}><ReturnEditor transaction={transaction} onClose={() => setOpen(false)} onSaved={onSaved} /></ProtectedDialog>}</>;
}
function ReturnEditor({ transaction, onClose, onSaved }: { transaction: Transaction; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [items, setItems] = useState<Record<string, "restock" | "discard">>({}), [reason, setReason] = useState(""), [saved, setSaved] = useState(false);
  const { operation, ownPending } = useInventoryFormOperation(() => setSaved(true), onSaved);
  const feedback = useFormFeedback();
  const locked = operation.busy || operation.pending.length > 0 || saved;
  const close = useDialogEditGuard(!saved && !ownPending && !!(Object.keys(items).length || reason), operation.busy);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (locked) return;
    if (!feedback.validate(e.currentTarget, { "return-reason": "Explica el motivo de la devolución." }, Object.keys(items).length ? {} : { "return-items": "Selecciona al menos una línea recibida." })) return;
    await operation.execute("return_sale_items", `/api/dashboard/transactions/${transaction.id}/inventory-returns`, { reason: reason.trim(), items: Object.entries(items).map(([transactionItemId, disposition]) => ({ transactionItemId, disposition })) }, "Devolución de mercancía");
  }
  return <FormDialogContent className="border-border bg-white shadow-xl">
    <FormDialogHeader><DialogTitle>Recibir mercancía de una venta anulada</DialogTitle><DialogDescription>Registra las líneas completas que recibiste. La mercancía apta repone su lote original; la dañada o vencida queda como no apta. Este registro no realiza un reembolso bancario.</DialogDescription></FormDialogHeader>
    <form className="flex min-h-0 flex-1 flex-col" noValidate aria-busy={operation.busy} onSubmit={submit}>
      <FormDialogBody><InventoryOperationStatus operation={operation} focusFeedback />
        {saved && <p role="status" className="text-sm text-teal-900">Recepción registrada. Las líneas recibidas se conservan en el historial.</p>}
        <fieldset disabled={locked} className="min-w-0 space-y-5">
          <FormSection title="Mercancía recibida" description="Selecciona únicamente las líneas completas que recibiste.">
            <div id="return-items" tabIndex={-1} aria-label="Líneas recibidas" {...feedback.fieldProps("return-items")} className="space-y-4 rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
              <FieldError id="return-items" message={feedback.errors["return-items"]} />
              {transaction.items.filter(i => i.productId).map(i => <div key={i.id} className="rounded-xl border p-4">
                <label htmlFor={`return-line-${i.id}`} className="flex min-h-11 cursor-pointer items-start gap-3"><input id={`return-line-${i.id}`} type="checkbox" className="mt-1 size-5 shrink-0 accent-teal-700" checked={!!items[i.id]} disabled={!!i.inventoryReturn} onChange={e => { feedback.clearField("return-items"); setItems(previous => { const next = { ...previous }; if (e.target.checked) next[i.id] = "restock"; else delete next[i.id]; return next; }); }} /><span className="min-w-0 break-words text-sm"><strong>{i.description}</strong><span className="mt-1 block text-xs text-muted-foreground">{i.quantity} unidades · {i.presentation}{i.inventoryReturn ? " · Devolución registrada" : ""}</span></span></label>
                {items[i.id] && <FormField id={`return-disposition-${i.id}`} label="Estado de la mercancía" className="mt-3"><select id={`return-disposition-${i.id}`} className="h-11 w-full rounded-xl border px-3 text-sm" value={items[i.id]} onChange={e => setItems(previous => ({ ...previous, [i.id]: e.target.value as "restock" | "discard" }))}><option value="restock">Apta · reponer existencias</option><option value="discard">Dañada o vencida · no reponer existencias</option></select></FormField>}
              </div>)}
            </div>
          </FormSection>
          <FormSection title="Justificación de la recepción"><FormField id="return-reason" label="Motivo de la devolución" error={feedback.errors["return-reason"]}><textarea id="return-reason" {...feedback.fieldProps("return-reason")} required maxLength={1000} rows={3} value={reason} onChange={e => { setReason(e.target.value); feedback.clearField("return-reason"); }} className="block w-full rounded-xl border p-3 focus-visible:outline-2 focus-visible:outline-primary" /></FormField></FormSection>
        </fieldset>
      </FormDialogBody>
      <FormDialogFooter><Button type="button" variant="outline" disabled={operation.busy} onClick={() => close(onClose)}>Cerrar</Button>{!saved && <Button type="submit" disabled={locked || !operation.ready}>{operation.busy ? "Guardando…" : "Guardar recepción"}</Button>}</FormDialogFooter>
    </form>
  </FormDialogContent>;
}
