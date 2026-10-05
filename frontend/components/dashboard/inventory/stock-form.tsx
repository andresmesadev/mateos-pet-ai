"use client";

import { useState } from "react";
import { ArrowRight, PackagePlus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInventoryOperation } from "@/lib/use-inventory-operation";
import { stockPreview, inventoryDate } from "@/lib/inventory-display";
import { formatPosMoney } from "@/lib/pos-checkout";
import type { InventoryProduct, InventoryMovement } from "@/lib/inventory";
import { InventoryOperationStatus } from "./operation-status";

export function StockForm({ product, mode, source, onClose, onSaved }: { product: InventoryProduct; mode: "entry" | "count" | "correction"; source?: InventoryMovement; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const operation = useInventoryOperation(onSaved);
  const [quantity, setQuantity] = useState(""), [cost, setCost] = useState(String(product.referenceCost ?? ""));
  const [lotCode, setLotCode] = useState(""), [expiresOn, setExpiresOn] = useState(""), [reason, setReason] = useState("");
  const [lotId, setLotId] = useState(product.lots[0]?.id ?? ""), [saved, setSaved] = useState(false);
  const locked = operation.busy || operation.pending.length > 0 || saved;
  const lot = product.lots.find(l => l.id === lotId);
  const preview = stockPreview(mode, quantity, product.physical, lot?.physical, mode === "correction" ? source?.quantity : undefined);
  const unitCost = Number(cost.replace(",", "."));
  const title = mode === "entry" ? "Registrar entrada" : mode === "count" ? "Conteo físico" : "Corregir consumo";
  async function submit(e: React.FormEvent) {
    e.preventDefault(); let ok = false;
    if (!preview) return;
    if (mode === "entry") ok = await operation.execute("register_entry", `/api/dashboard/inventory/products/${product.id}/entries`, { quantity: Number(quantity), unitCost: cost.replace(",", "."), lotCode: lotCode.trim() || null, expiresOn: expiresOn || null, reason: reason.trim() || null }, `Entrada · ${product.name}`);
    if (mode === "count") ok = await operation.execute("adjust_stock", `/api/dashboard/inventory/products/${product.id}/adjustments`, { lotId, countedQuantity: Number(quantity), expectedStockRevision: product.stockRevision, reason: reason.trim() }, `Conteo · ${product.name}`);
    if (mode === "correction" && source) ok = await operation.execute("correct_consumption", `/api/dashboard/inventory/consumptions/${source.operationId}/corrections`, { sourceMovementId: source.id, quantity: Number(quantity), reason: reason.trim() }, `Corrección · ${product.name}`);
    if (ok) setSaved(true);
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden border-border bg-white shadow-xl">
      <DialogHeader className="shrink-0 border-border pr-12"><DialogTitle className="flex items-center gap-2 text-xl">{mode === "entry" ? <PackagePlus className="size-5 text-primary" /> : <ClipboardList className="size-5 text-primary" />}{title}</DialogTitle><DialogDescription>{product.name} · {product.internalCode}</DialogDescription></DialogHeader>
      <form className="flex min-h-0 flex-col" onSubmit={submit}>
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <InventoryOperationStatus operation={operation} />
          <div className="rounded-xl bg-muted/40 p-4"><p className="text-sm font-semibold">1 unidad = {product.presentation}</p><p className="mt-1 text-xs text-muted-foreground">Registra presentaciones completas. Saldo consultado al abrir: {product.physical} unidades físicas, {product.available} disponibles.</p></div>
          {saved && <p className="text-sm text-teal-900">Movimiento registrado. Cierra esta ventana para consultar el saldo actualizado en el listado.</p>}
          <fieldset disabled={locked} className="space-y-4">
            {mode === "count" && <label className="block text-sm font-semibold">Lote a contar<select className="mt-2 h-11 w-full rounded-xl border bg-white px-3 font-normal focus-visible:outline-2 focus-visible:outline-primary" value={lotId} onChange={e => { setLotId(e.target.value); setQuantity(""); }}>{product.lots.map(l => <option key={l.id} value={l.id}>{l.lotCode ?? "Sin lote"} · {l.physical} unidades físicas{l.expiresOn ? ` · Vence ${inventoryDate(l.expiresOn)}` : ""}</option>)}</select><span className="mt-2 block text-xs font-normal text-muted-foreground">Cuenta también las unidades vencidas. Escribe el total que encontraste en este lote.</span></label>}
            {mode === "correction" && source && <p className="rounded-xl border p-3 text-sm">Consumo original: <strong>{source.quantity} unidades</strong> · {source.lotCodeSnapshot ?? "Sin lote"}. Devuelve solo las unidades no utilizadas; el consumo original permanece en el historial.</p>}
            <label className="block text-sm font-semibold">{mode === "entry" ? "Unidades recibidas" : mode === "count" ? "Total contado físicamente en el lote" : "Unidades no utilizadas"}<Input required type="number" min={mode === "count" ? 0 : 1} max={mode === "correction" ? source?.quantity : 2147483647} step={1} value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-2 font-normal" placeholder={mode === "count" ? "Ej. 8 unidades en total" : "Ej. 12 unidades"} /></label>
            {mode === "entry" && <>
              <label className="block text-sm font-semibold">Costo de entrada por unidad (COP)<Input required inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} className="mt-2 font-normal" placeholder="Ej. 12000" /><span className="mt-1 block text-xs font-normal text-muted-foreground">{cost.trim() && Number.isFinite(unitCost) && unitCost >= 0 ? formatPosMoney(unitCost) : "Valor en pesos, sin separadores de miles."}</span></label>
              {product.lotPolicy !== "untracked" && <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Código de lote<Input required maxLength={80} value={lotCode} onChange={e => setLotCode(e.target.value)} className="mt-2 font-normal" placeholder="Código impreso en el empaque" /></label>{product.lotPolicy === "lot_expiry" && <label className="block text-sm font-semibold">Fecha de vencimiento<Input required type="date" value={expiresOn} onChange={e => setExpiresOn(e.target.value)} className="mt-2 font-normal" /></label>}</div>}
            </>}
            <label className="block text-sm font-semibold">{mode === "entry" ? "Nota de la entrada (opcional)" : "Motivo del ajuste"}<textarea required={mode !== "entry"} maxLength={1000} rows={3} value={reason} onChange={e => setReason(e.target.value)} className="mt-2 block w-full rounded-xl border bg-white p-3 font-normal focus-visible:outline-2 focus-visible:outline-primary" placeholder={mode === "entry" ? "Ej. Mercancía recibida, referencia de recepción" : "Ej. Diferencia en conteo, unidades dañadas o no utilizadas"} /></label>
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
        </div>
        <DialogFooter className="shrink-0 border-border"><Button type="button" variant="outline" onClick={onClose}>{saved ? "Cerrar" : "Cancelar"}</Button>{!saved && <Button type="submit" disabled={locked || !operation.ready || !preview || (mode === "count" && !lotId)}>{operation.busy ? "Guardando…" : mode === "entry" ? "Guardar entrada" : mode === "count" ? "Guardar conteo" : "Guardar corrección"}</Button>}</DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
