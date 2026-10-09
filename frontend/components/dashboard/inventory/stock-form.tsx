"use client";

import { useState } from "react";
import { ArrowRight, PackagePlus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProtectedDialog, useDialogEditGuard } from "../protected-dialog";
import { FormDialogContent, FormDialogHeader, FormDialogBody, FormDialogFooter, FormSection, FormField, FormAdditional } from "../form-layout";
import { useFormFeedback } from "../form-feedback";
import { useInventoryFormOperation } from "./use-inventory-form-operation";
import { stockPreview, inventoryDate } from "@/lib/inventory-display";
import { formatPosMoney } from "@/lib/pos-checkout";
import type { InventoryProduct, InventoryMovement } from "@/lib/inventory";
import { InventoryOperationStatus } from "./operation-status";

export function StockForm({ product, mode, source, onClose, onSaved }: { product: InventoryProduct; mode: "entry" | "count" | "correction"; source?: InventoryMovement; onClose: () => void; onSaved: () => void | Promise<void> }) {
  return <ProtectedDialog open onOpenChange={open => { if (!open) onClose(); }}><StockEditor product={product} mode={mode} source={source} onClose={onClose} onSaved={onSaved} /></ProtectedDialog>;
}

function StockEditor({ product, mode, source, onClose, onSaved }: Parameters<typeof StockForm>[0]) {
  const [quantity, setQuantity] = useState(""), [cost, setCost] = useState(String(product.referenceCost ?? ""));
  const [lotCode, setLotCode] = useState(""), [expiresOn, setExpiresOn] = useState(""), [reason, setReason] = useState("");
  const [lotId, setLotId] = useState(product.lots[0]?.id ?? ""), [saved, setSaved] = useState(false);
  const { operation, ownPending } = useInventoryFormOperation(() => setSaved(true), onSaved);
  const feedback = useFormFeedback();
  const dirty = !saved && !ownPending && !!(quantity || lotCode || expiresOn || reason || cost !== String(product.referenceCost ?? "") || lotId !== (product.lots[0]?.id ?? ""));
  const close = useDialogEditGuard(dirty, operation.busy);
  const locked = operation.busy || operation.pending.length > 0 || saved;
  const lot = product.lots.find(l => l.id === lotId);
  const preview = stockPreview(mode, quantity, product.physical, lot?.physical, mode === "correction" ? source?.quantity : undefined);
  const unitCost = Number(cost.replace(",", "."));
  const title = mode === "entry" ? "Registrar entrada" : mode === "count" ? "Conteo físico" : "Corregir consumo";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); let ok = false;
    if (locked) return;
    const custom: Record<string, string> = {};
    if (mode === "entry" && cost.trim() && !/^\d{1,8}([.,]\d{1,2})?$/.test(cost.trim())) custom["stock-cost"] = "Escribe un costo en pesos, sin separadores de miles y con hasta dos decimales.";
    if (!feedback.validate(e.currentTarget, { "stock-quantity": "Escribe la cantidad de unidades.", "stock-cost": "Escribe el costo por unidad.", "stock-lot": "Selecciona el lote que contaste.", "stock-lotCode": "Escribe el código del lote.", "stock-expiresOn": "Indica la fecha de vencimiento.", ...(mode !== "entry" ? { "stock-reason": "Explica el motivo del ajuste." } : {}) }, custom)) return;
    if (!preview) return;
    if (mode === "entry") ok = await operation.execute("register_entry", `/api/dashboard/inventory/products/${product.id}/entries`, { quantity: Number(quantity), unitCost: cost.replace(",", "."), lotCode: lotCode.trim() || null, expiresOn: expiresOn || null, reason: reason.trim() || null }, `Entrada · ${product.name}`);
    if (mode === "count") ok = await operation.execute("adjust_stock", `/api/dashboard/inventory/products/${product.id}/adjustments`, { lotId, countedQuantity: Number(quantity), expectedStockRevision: product.stockRevision, reason: reason.trim() }, `Conteo · ${product.name}`);
    if (mode === "correction" && source) ok = await operation.execute("correct_consumption", `/api/dashboard/inventory/consumptions/${source.operationId}/corrections`, { sourceMovementId: source.id, quantity: Number(quantity), reason: reason.trim() }, `Corrección · ${product.name}`);
    if (ok) setSaved(true);
  }
  return <FormDialogContent className="border-border bg-white shadow-xl" onCloseAutoFocus={event => event.preventDefault()}>
      <FormDialogHeader><DialogTitle className="flex items-center gap-2 text-xl">{mode === "entry" ? <PackagePlus className="size-5 text-primary" /> : <ClipboardList className="size-5 text-primary" />}{title}</DialogTitle><DialogDescription>{product.name} · {product.internalCode}</DialogDescription></FormDialogHeader>
      <form className="flex min-h-0 flex-1 flex-col" noValidate aria-busy={operation.busy} onSubmit={submit}>
        <FormDialogBody>
          <InventoryOperationStatus operation={operation} focusFeedback />
          <div className="rounded-xl bg-muted/40 p-4"><p className="text-sm font-semibold">1 unidad = {product.presentation}</p><p className="mt-1 text-xs text-muted-foreground">Registra presentaciones completas. Saldo consultado al abrir: {product.physical} unidades físicas, {product.available} disponibles.</p></div>
          {saved && <p className="text-sm text-teal-900">Movimiento registrado. Cierra esta ventana para consultar el saldo actualizado en el listado.</p>}
          <fieldset disabled={locked} className="min-w-0 space-y-5">
          <FormSection title={mode === "entry" ? "Mercancía recibida" : mode === "count" ? "Resultado del conteo" : "Unidades que regresan al inventario"}>
            {mode === "count" && <FormField id="stock-lot" label="Lote a contar" hint="Cuenta también las unidades vencidas. Escribe el total que encontraste en este lote." error={feedback.errors["stock-lot"]}><select id="stock-lot" required {...feedback.fieldProps("stock-lot", true)} className="h-11 w-full rounded-xl border bg-white px-3 font-normal focus-visible:outline-2 focus-visible:outline-primary" value={lotId} onChange={e => { setLotId(e.target.value); setQuantity(""); feedback.clear(); }}><option value="">Seleccionar lote</option>{product.lots.map(l => <option key={l.id} value={l.id}>{l.lotCode ?? "Sin lote"} · {l.physical} unidades físicas{l.expiresOn ? ` · Vence ${inventoryDate(l.expiresOn)}` : ""}</option>)}</select></FormField>}
            {mode === "correction" && source && <p className="rounded-xl border p-3 text-sm">Consumo original: <strong>{source.quantity} unidades</strong> · {source.lotCodeSnapshot ?? "Sin lote"}. Devuelve solo las unidades no utilizadas; el consumo original permanece en el historial.</p>}
            <FormField id="stock-quantity" label={mode === "entry" ? "Unidades recibidas" : mode === "count" ? "Total contado físicamente en el lote" : "Unidades no utilizadas"} error={feedback.errors["stock-quantity"]}><Input id="stock-quantity" {...feedback.fieldProps("stock-quantity")} required type="number" min={mode === "count" ? 0 : 1} max={mode === "correction" ? source?.quantity : 2147483647} step={1} value={quantity} onChange={e => { setQuantity(e.target.value); feedback.clearField("stock-quantity"); }} placeholder={mode === "count" ? "Ej. 8 unidades en total" : "Ej. 12 unidades"} /></FormField>
            {mode === "entry" && <>
              <FormField id="stock-cost" label="Costo de entrada por unidad (COP)" error={feedback.errors["stock-cost"]} hint={cost.trim() && Number.isFinite(unitCost) && unitCost >= 0 ? formatPosMoney(unitCost) : "Valor en pesos, sin separadores de miles."}><Input id="stock-cost" {...feedback.fieldProps("stock-cost", true)} required inputMode="decimal" value={cost} onChange={e => { setCost(e.target.value); feedback.clearField("stock-cost"); }} placeholder="Ej. 12000" /></FormField>
              {product.lotPolicy !== "untracked" && <div className="grid gap-4 sm:grid-cols-2"><FormField id="stock-lotCode" label="Código de lote" error={feedback.errors["stock-lotCode"]}><Input id="stock-lotCode" {...feedback.fieldProps("stock-lotCode")} required maxLength={80} value={lotCode} onChange={e => { setLotCode(e.target.value); feedback.clearField("stock-lotCode"); }} placeholder="Código impreso en el empaque" /></FormField>{product.lotPolicy === "lot_expiry" && <FormField id="stock-expiresOn" label="Fecha de vencimiento" error={feedback.errors["stock-expiresOn"]}><Input id="stock-expiresOn" {...feedback.fieldProps("stock-expiresOn")} required type="date" value={expiresOn} onChange={e => { setExpiresOn(e.target.value); feedback.clearField("stock-expiresOn"); }} /></FormField>}</div>}
            </>}
          </FormSection>
          {mode === "entry" ? <FormAdditional><FormField id="stock-reason" label="Nota de la entrada" optional error={feedback.errors["stock-reason"]}><textarea id="stock-reason" {...feedback.fieldProps("stock-reason")} maxLength={1000} rows={3} value={reason} onChange={e => { setReason(e.target.value); feedback.clearField("stock-reason"); }} className="block w-full rounded-xl border bg-white p-3 focus-visible:outline-2 focus-visible:outline-primary" placeholder="Ej. Mercancía recibida, referencia de recepción" /></FormField></FormAdditional> : <FormSection title="Justificación del movimiento"><FormField id="stock-reason" label="Motivo del ajuste" error={feedback.errors["stock-reason"]}><textarea id="stock-reason" {...feedback.fieldProps("stock-reason")} required maxLength={1000} rows={3} value={reason} onChange={e => { setReason(e.target.value); feedback.clearField("stock-reason"); }} className="block w-full rounded-xl border bg-white p-3 focus-visible:outline-2 focus-visible:outline-primary" placeholder="Ej. Diferencia en conteo, unidades dañadas o no utilizadas" /></FormField></FormSection>}
          </fieldset>
          {!saved && <section aria-label="Vista previa del movimiento" aria-live="polite" className={`rounded-xl border p-4 ${preview?.delta && preview.delta < 0 ? "border-amber-200 bg-amber-50" : "border-teal-200 bg-teal-50/60"}`}>
            <h2 className="text-sm font-semibold">Antes de guardar</h2>
            {preview ? <>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3"><div><p className="text-xs text-muted-foreground">{mode === "count" ? "Saldo del lote" : "Saldo físico del producto"}</p><p className="mt-1 text-xl font-bold tabular-nums">{mode === "count" ? lot?.physical ?? 0 : product.physical}</p></div><ArrowRight className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">{mode === "count" ? "Total contado" : "Saldo físico previsto"}</p><p className="mt-1 text-xl font-bold tabular-nums">{mode === "count" ? preview.quantity : preview.physicalAfter}</p></div><p className="text-sm font-semibold">{preview.delta === 0 ? "Sin diferencia" : `${preview.delta > 0 ? "+" : ""}${preview.delta} unidades`}</p></div>
              {mode === "count" && <p className="mt-3 text-sm">Saldo físico previsto del producto: <strong>{preview.physicalAfter} unidades</strong>. {preview.delta < 0 ? "Se registrará una salida por la diferencia." : preview.delta > 0 ? "Se registrará una entrada por la diferencia." : "El conteo coincide con el saldo registrado."}</p>}
              {mode === "entry" && cost.trim() && Number.isFinite(unitCost) && unitCost >= 0 && <p className="mt-3 text-sm">Costo de esta entrada: <strong>{formatPosMoney(unitCost * preview.quantity)}</strong></p>}
              <p className="mt-3 text-xs text-muted-foreground">Vista previa basada en el saldo consultado. Al guardar se validan las existencias actuales; las unidades vencidas quedan fuera de las disponibles.</p>
            </> : <p className="mt-2 text-sm text-muted-foreground">Ingresa una cantidad válida para revisar cómo cambiará el saldo.</p>}
          </section>}
        </FormDialogBody>
        <FormDialogFooter><Button type="button" variant="outline" disabled={operation.busy} onClick={() => close(onClose)}>{saved || ownPending ? "Cerrar" : "Cancelar"}</Button>{!saved && <Button type="submit" disabled={locked || !operation.ready || (mode === "correction" && !source)}>{operation.busy ? "Guardando…" : mode === "entry" ? "Guardar entrada" : mode === "count" ? "Guardar conteo" : "Guardar corrección"}</Button>}</FormDialogFooter>
      </form>
    </FormDialogContent>;
}
