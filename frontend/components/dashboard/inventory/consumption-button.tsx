"use client";
import { useState } from "react";
import { PackageMinus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDashboardAccess } from "../dashboard-access-provider";
import { ProtectedDialog, useDialogEditGuard } from "../protected-dialog";
import { FormDialogContent, FormDialogHeader, FormDialogBody, FormDialogFooter, FormSection, FormField } from "../form-layout";
import { FieldError, useFormFeedback } from "../form-feedback";
import { USE_NAMES, type InventoryProduct, type ProductUse } from "@/lib/inventory";
import { ProductPicker } from "./product-picker";
import { InventoryOperationStatus } from "./operation-status";
import { useInventoryFormOperation } from "./use-inventory-form-operation";

export function ConsumptionButton({ area, appointmentId, onSaved }: { area: "veterinary" | "grooming"; appointmentId?: string; onSaved?: () => void | Promise<void> }) {
  const access = useDashboardAccess(), [open, setOpen] = useState(false);
  if (!access?.capabilities.inventory_consume) return null;
  return <><Button type="button" variant="outline" onClick={() => setOpen(true)}><PackageMinus className="mr-2 h-4 w-4" />Insumos utilizados</Button>{open && <ConsumptionDialog area={area} appointmentId={appointmentId} onClose={() => setOpen(false)} onSaved={onSaved} />}</>;
}
export function ConsumptionDialog(props: { area: ProductUse; appointmentId?: string; onClose: () => void; onSaved?: () => void | Promise<void> }) {
  return <ProtectedDialog open onOpenChange={open => { if (!open) props.onClose(); }}><ConsumptionEditor {...props} /></ProtectedDialog>;
}
function ConsumptionEditor({ area: initialArea, appointmentId, onClose, onSaved }: Parameters<typeof ConsumptionDialog>[0]) {
  const access = useDashboardAccess();
  const [area, setArea] = useState(initialArea), [items, setItems] = useState<{ product: InventoryProduct; quantity: string }[]>([]), [reason, setReason] = useState("");
  const feedback = useFormFeedback();
  const { operation, ownPending } = useInventoryFormOperation(() => { setItems([]); setReason(""); setArea(initialArea); feedback.clear(); }, onSaved);
  const locked = operation.busy || operation.pending.length > 0;
  const close = useDialogEditGuard(!ownPending && !!(items.length || reason || area !== initialArea), operation.busy);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (locked) return;
    if (!feedback.validate(e.currentTarget, appointmentId ? {} : { "consumption-reason": "Explica para qué se utilizaron los insumos." }, items.length ? {} : { "consumption-products": "Agrega al menos un insumo utilizado." })) return;
    await operation.execute("register_consumption", "/api/dashboard/inventory/consumptions", { area, appointmentId: appointmentId ?? null, reason: reason.trim() || null, items: items.map(i => ({ productId: i.product.id, quantity: Number(i.quantity) })) }, "Insumos utilizados");
  }
  return <FormDialogContent className="max-w-3xl border-border bg-white shadow-xl" onEscapeKeyDown={event => {
    const target = event.target;
    // Radix handles Escape during capture, before the picker's React handler.
    if (target instanceof HTMLInputElement && target.id === "consumption-search" && (target.value || target.getAttribute("aria-expanded") === "true")) event.preventDefault();
  }}>
    <FormDialogHeader><DialogTitle>Registrar insumos utilizados</DialogTitle><DialogDescription>Descuenta unidades del inventario. Cada registro conserva el profesional y la fecha; no genera un cobro.</DialogDescription></FormDialogHeader>
    <form onSubmit={submit} noValidate aria-busy={operation.busy} className="flex min-h-0 flex-1 flex-col">
      <FormDialogBody><InventoryOperationStatus operation={operation} focusFeedback />
        <fieldset disabled={locked} className="min-w-0 space-y-5">
          <FormSection title="Insumos de esta atención" description="Una unidad equivale a una presentación completa. No se descuentan fracciones ni se copia la historia clínica.">
            {access?.capabilities.administration && !appointmentId && <FormField id="consumption-area" label="Área"><select id="consumption-area" className="h-11 w-full rounded-xl border px-3" value={area} onChange={e => { setArea(e.target.value as ProductUse); setItems([]); feedback.clear(); }}>{access.activeModules.filter(m => m !== "retail").map(m => <option key={m} value={m}>{USE_NAMES[m as ProductUse]}</option>)}</select></FormField>}
            <div id="consumption-products" tabIndex={-1} {...feedback.fieldProps("consumption-products")} aria-label="Insumos seleccionados" className="min-w-0 space-y-4 rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
              <label htmlFor="consumption-search" className="block text-sm font-semibold">Buscar insumo</label>
              <ProductPicker inputId="consumption-search" use={area} onSelect={p => { feedback.clearField("consumption-products"); setItems(previous => { const found = previous.find(i => i.product.id === p.id); return found ? previous.map(i => i === found ? { ...i, quantity: String(Number(i.quantity) + 1) } : i) : [...previous, { product: p, quantity: "1" }]; }); }} />
              <FieldError id="consumption-products" message={feedback.errors["consumption-products"]} />
              {items.map(i => { const id = `consumption-quantity-${i.product.id}`; return <div key={i.product.id} className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
                <div className="min-w-0 basis-40 flex-1"><strong className="break-words text-sm">{i.product.name}</strong><p className="text-xs text-muted-foreground">{i.product.presentation} · {i.product.available} disponibles</p></div>
                <FormField id={id} label="Unidades" error={feedback.errors[id]} className="w-28"><Input id={id} {...feedback.fieldProps(id)} required type="number" min={1} max={2147483647} step={1} value={i.quantity} onChange={e => { feedback.clearField(id); setItems(list => list.map(x => x === i ? { ...x, quantity: e.target.value } : x)); }} /></FormField>
                <Button type="button" variant="ghost" className="size-11 shrink-0" aria-label={`Quitar ${i.product.name}`} onClick={() => { feedback.clearField(id); setItems(list => list.filter(x => x !== i)); }}><Trash2 className="h-4 w-4" /></Button>
              </div>; })}
            </div>
          </FormSection>
          <FormSection title="Referencia del consumo"><FormField id="consumption-reason" label="Motivo del consumo" optional={!!appointmentId} hint={appointmentId ? "Este registro queda vinculado a la atención seleccionada." : "Indica para qué se utilizaron los insumos."} error={feedback.errors["consumption-reason"]}><textarea id="consumption-reason" {...feedback.fieldProps("consumption-reason", true)} required={!appointmentId} maxLength={1000} rows={3} value={reason} onChange={e => { setReason(e.target.value); feedback.clearField("consumption-reason"); }} className="block w-full rounded-xl border p-3 focus-visible:outline-2 focus-visible:outline-primary" placeholder="Ej. Material utilizado durante la atención" /></FormField></FormSection>
        </fieldset>
      </FormDialogBody>
      <FormDialogFooter><Button type="button" variant="outline" disabled={operation.busy} onClick={() => close(onClose)}>Cerrar</Button><Button type="submit" disabled={locked || !operation.ready}>{operation.busy ? "Guardando…" : "Guardar consumo"}</Button></FormDialogFooter>
    </form>
  </FormDialogContent>;
}
