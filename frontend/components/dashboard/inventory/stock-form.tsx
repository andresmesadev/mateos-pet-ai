"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInventoryOperation } from "@/lib/use-inventory-operation";
import type { InventoryProduct, InventoryMovement } from "@/lib/inventory";
import { InventoryOperationStatus } from "./operation-status";
export function StockForm({ product, mode, source, onClose, onSaved }: {product:InventoryProduct;mode:"entry"|"count"|"correction";source?:InventoryMovement;onClose:()=>void;onSaved:()=>void|Promise<void>}) {
  const operation=useInventoryOperation(onSaved);
  const [quantity,setQuantity]=useState(""),[cost,setCost]=useState(String(product.referenceCost??"")),[lotCode,setLotCode]=useState(""),[expiresOn,setExpiresOn]=useState(""),[reason,setReason]=useState("");
  const [lotId,setLotId]=useState(product.lots[0]?.id??""),[saved,setSaved]=useState(false);
  const locked=operation.busy||operation.pending.length>0||saved;
  const lot=product.lots.find(l=>l.id===lotId);
  async function submit(e:React.FormEvent) {e.preventDefault(); let ok=false;
    if(mode==="entry") ok=await operation.execute("register_entry",`/api/dashboard/inventory/products/${product.id}/entries`,{quantity:Number(quantity),unitCost:cost.replace(",","."),lotCode:lotCode.trim()||null,expiresOn:expiresOn||null,reason:reason.trim()||null},`Entrada · ${product.name}`);
    if(mode==="count") ok=await operation.execute("adjust_stock",`/api/dashboard/inventory/products/${product.id}/adjustments`,{lotId,countedQuantity:Number(quantity),expectedStockRevision:product.stockRevision,reason:reason.trim()},`Conteo · ${product.name}`);
    if(mode==="correction"&&source) ok=await operation.execute("correct_consumption",`/api/dashboard/inventory/consumptions/${source.operationId}/corrections`,{sourceMovementId:source.id,quantity:Number(quantity),reason:reason.trim()},`Corrección · ${product.name}`);
    if(ok)setSaved(true);
  }
  return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden border-border bg-white shadow-xl"><DialogHeader><DialogTitle>{mode==="entry"?"Registrar entrada":mode==="count"?"Verificar existencias físicas":"Corregir consumo"}</DialogTitle><DialogDescription>{product.name} · {product.presentation}</DialogDescription></DialogHeader><form className="flex min-h-0 flex-col" onSubmit={submit}><div className="space-y-4 overflow-y-auto px-6 pb-5"><InventoryOperationStatus operation={operation}/><fieldset disabled={locked} className="space-y-4">
    {mode==="count"&&<><label className="block text-sm font-semibold">Lote a contar<select className="mt-2 h-11 w-full rounded-xl border px-3 font-normal" value={lotId} onChange={e=>{setLotId(e.target.value);setQuantity("");}}>{product.lots.map(l=><option key={l.id} value={l.id}>{l.lotCode??"Sin lote"} · {l.physical} unidades físicas{l.expiresOn?` · Vence ${l.expiresOn}`:""}</option>)}</select></label><p className="rounded-xl bg-muted p-3 text-sm">Saldo registrado: <strong>{lot?.physical??0} unidades</strong>. Cuenta la mercancía físicamente; el ajuste será la diferencia.</p></>}
    {mode==="correction"&&source&&<p className="rounded-xl bg-muted p-3 text-sm">Consumo original: {source.quantity} unidades · {source.lotCodeSnapshot??"Sin lote"}. La corrección devuelve las unidades no utilizadas sin borrar el registro original.</p>}
    <label className="block text-sm font-semibold">{mode==="entry"?"Unidades recibidas":mode==="count"?"Unidades contadas físicamente":"Unidades no utilizadas"}<Input required type="number" min={mode==="count"?0:1} max={mode==="correction"?source?.quantity:2147483647} step={1} value={quantity} onChange={e=>setQuantity(e.target.value)} className="mt-2 font-normal" placeholder="Cantidad de presentaciones completas"/></label>
    {mode==="entry"&&<><label className="block text-sm font-semibold">Costo de entrada por unidad (COP)<Input required inputMode="decimal" value={cost} onChange={e=>setCost(e.target.value)} className="mt-2 font-normal" placeholder="Sin separadores de miles" /></label>{product.lotPolicy!=="untracked"&&<label className="block text-sm font-semibold">Código de lote<Input required maxLength={80} value={lotCode} onChange={e=>setLotCode(e.target.value)} className="mt-2 font-normal" /></label>}{product.lotPolicy==="lot_expiry"&&<label className="block text-sm font-semibold">Fecha de vencimiento<Input required type="date" value={expiresOn} onChange={e=>setExpiresOn(e.target.value)} className="mt-2 font-normal" /></label>}</>}
    <label className="block text-sm font-semibold">{mode==="entry"?"Nota de la entrada (opcional)":"Motivo del ajuste"}<textarea required={mode!=="entry"} maxLength={1000} rows={3} value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 block w-full rounded-xl border p-3 font-normal focus-visible:outline-2 focus-visible:outline-primary" placeholder={mode==="entry"?"Ej. Compra al proveedor, referencia de recepción":"Explica la diferencia o corrección"}/></label>
  </fieldset></div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>{!saved&&<Button type="submit" disabled={locked||!operation.ready||(mode==="count"&&!lotId)}>{operation.busy?"Guardando…":mode==="entry"?"Guardar entrada":"Guardar ajuste"}</Button>}</DialogFooter></form></DialogContent></Dialog>;
}
