"use client";
import { useState } from "react";
import { PackageMinus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { useInventoryOperation } from "@/lib/use-inventory-operation";
import { USE_NAMES, type InventoryProduct, type ProductUse } from "@/lib/inventory";
import { ProductPicker } from "./product-picker";
import { InventoryOperationStatus } from "./operation-status";
export function ConsumptionButton({ area, appointmentId, onSaved }: { area:"veterinary"|"grooming"; appointmentId?:string; onSaved?:()=>void|Promise<void> }) {
  const access=useDashboardAccess(); const [open,setOpen]=useState(false);
  if(!access?.capabilities.inventory_consume) return null;
  return <><Button type="button" variant="outline" onClick={()=>setOpen(true)}><PackageMinus className="mr-2 h-4 w-4" />Insumos utilizados</Button>{open&&<ConsumptionDialog area={area} appointmentId={appointmentId} onClose={()=>setOpen(false)} onSaved={onSaved}/>}</>;
}
export function ConsumptionDialog({ area:initialArea, appointmentId, onClose, onSaved }: { area:ProductUse; appointmentId?:string; onClose:()=>void; onSaved?:()=>void|Promise<void> }) {
  const access=useDashboardAccess(), operation=useInventoryOperation(onSaved);
  const [area,setArea]=useState(initialArea),[items,setItems]=useState<{product:InventoryProduct;quantity:string}[]>([]),[reason,setReason]=useState("");
  const locked=operation.busy||operation.pending.length>0;
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(await operation.execute("register_consumption","/api/dashboard/inventory/consumptions",{area,appointmentId:appointmentId??null,reason:reason.trim()||null,items:items.map(i=>({productId:i.product.id,quantity:Number(i.quantity)}))},"Insumos utilizados")) {setItems([]);setReason("");}
  }
  return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden border-border bg-white shadow-xl"><DialogHeader><DialogTitle>Registrar insumos utilizados</DialogTitle><DialogDescription>Descuenta unidades del inventario. Cada registro conserva el profesional y la fecha; no genera un cobro.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="flex min-h-0 flex-col"><div className="space-y-4 overflow-y-auto px-6 pb-5"><InventoryOperationStatus operation={operation}/><fieldset disabled={locked} className="space-y-4">
      {access?.capabilities.administration&&!appointmentId&&<label className="block text-sm font-semibold">Área<select className="mt-2 h-11 w-full rounded-xl border px-3 font-normal" value={area} onChange={e=>{setArea(e.target.value as ProductUse);setItems([]);}}>{access.activeModules.filter(m=>m!=="retail").map(m=><option key={m} value={m}>{USE_NAMES[m as ProductUse]}</option>)}</select></label>}
      <ProductPicker use={area} onSelect={p=>setItems(previous=>{const found=previous.find(i=>i.product.id===p.id);return found?previous.map(i=>i===found?{...i,quantity:String(Number(i.quantity)+1)}:i):[...previous,{product:p,quantity:"1"}];})}/>
      {items.map(i=><div key={i.product.id} className="flex flex-wrap items-end gap-3 rounded-xl border p-3"><div className="min-w-40 flex-1"><strong className="text-sm">{i.product.name}</strong><p className="text-xs text-muted-foreground">{i.product.presentation} · {i.product.available} disponibles</p></div><label className="text-xs font-medium">Unidades<Input required type="number" min={1} step={1} value={i.quantity} className="mt-1 w-24" onChange={e=>setItems(list=>list.map(x=>x===i?{...x,quantity:e.target.value}:x))}/></label><Button type="button" variant="ghost" aria-label={`Quitar ${i.product.name}`} onClick={()=>setItems(list=>list.filter(x=>x!==i))}><Trash2 className="h-4 w-4" /></Button></div>)}
      <label className="block text-sm font-semibold">Motivo {appointmentId ? "(opcional, vinculado a esta atención)" : "del consumo"}<textarea required={!appointmentId} maxLength={1000} rows={3} value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 block w-full rounded-xl border p-3 font-normal focus-visible:outline-2 focus-visible:outline-primary" placeholder="Ej. Material utilizado durante la atención" /></label>
      <p className="text-xs text-muted-foreground">Una unidad equivale a una presentación completa. No se descuentan fracciones ni se copia la historia clínica.</p>
    </fieldset></div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cerrar</Button><Button type="submit" disabled={locked||!operation.ready||!items.length}>{operation.busy?"Guardando…":"Guardar consumo"}</Button></DialogFooter></form>
  </DialogContent></Dialog>;
}
