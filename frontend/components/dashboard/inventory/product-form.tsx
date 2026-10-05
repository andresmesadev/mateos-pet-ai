"use client";

import { useState } from "react";
import { Package, BadgeDollarSign, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { useInventoryOperation } from "@/lib/use-inventory-operation";
import { formatPosMoney } from "@/lib/pos-checkout";
import { USE_NAMES, type InventoryProduct, type ProductUse } from "@/lib/inventory";
import { InventoryOperationStatus } from "./operation-status";

const selectClass = "mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-primary";
function MoneyHint({ value }: { value: string }) {
  const number = Number(value.replace(",", "."));
  return <span className="mt-1 block text-xs font-normal text-muted-foreground">{value.trim() && Number.isFinite(number) && number >= 0 ? formatPosMoney(number) : "Ingresa el valor en pesos, sin separadores de miles."}</span>;
}

export function ProductForm({ product, onClose, onSaved }: { product?: InventoryProduct; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const access = useDashboardAccess(), operation = useInventoryOperation(onSaved);
  const [values, setValues] = useState({ name: product?.name ?? "", internalCode: product?.internalCode ?? "", barcode: product?.barcode ?? "", category: product?.category ?? "", presentation: product?.presentation ?? "", referenceCost: String(product?.referenceCost ?? ""), salePrice: String(product?.salePrice ?? ""), stockMinimum: String(product?.stockMinimum ?? 0), lotPolicy: product?.lotPolicy ?? "untracked" });
  const [uses, setUses] = useState<ProductUse[]>(product?.uses ?? []), [saved, setSaved] = useState(false);
  const locked = operation.busy || operation.pending.length > 0 || saved;
  const fixedPresentation = !!product && product.stockRevision > 0;
  const change = (field: keyof typeof values, value: string) => setValues(v => ({ ...v, [field]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await operation.execute(product ? "update_product" : "create_product", `/api/dashboard/inventory/products${product ? "/" + product.id : ""}`, { ...values, barcode: values.barcode.trim() || null, salePrice: values.salePrice.trim().replace(",", ".") || null, referenceCost: values.referenceCost.replace(",", "."), stockMinimum: Number(values.stockMinimum), uses, ...(product ? { expectedVersion: product.metadataVersion } : {}) }, product ? `Editar ${product.name}` : "Nuevo producto", product ? "PATCH" : "POST");
    if (ok) setSaved(true);
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden border-border bg-white shadow-xl">
      <DialogHeader className="shrink-0 border-border pr-12"><DialogTitle className="text-xl">{product ? "Editar producto" : "Nuevo producto o insumo"}</DialogTitle><DialogDescription>Define qué producto es, cómo se utiliza y cómo controlar sus existencias.</DialogDescription></DialogHeader>
      <form className="flex min-h-0 flex-col" onSubmit={submit}>
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <InventoryOperationStatus operation={operation} />
          {saved && !product && <p className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900">Producto registrado. Ahora puedes ingresar las unidades recibidas desde el botón Entrada del listado.</p>}
          <fieldset disabled={locked} className="space-y-6">
            <section aria-labelledby="product-identity"><h2 id="product-identity" className="mb-4 flex items-center gap-2 font-semibold"><Package className="size-5 text-primary" />Identificación del producto</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold sm:col-span-2">Nombre<Input required maxLength={160} value={values.name} onChange={e => change("name", e.target.value)} className="mt-2 font-normal" placeholder="Ej. Champú para piel sensible" /></label>
                <label className="text-sm font-semibold">Código interno<Input required maxLength={64} value={values.internalCode} onChange={e => change("internalCode", e.target.value)} className="mt-2 font-normal" placeholder="Ej. CH-001" /></label>
                <label className="text-sm font-semibold">Código de barras (opcional)<Input maxLength={80} value={values.barcode} onChange={e => change("barcode", e.target.value)} className="mt-2 font-normal" placeholder="Escanea o escribe el código" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Se conservan los ceros al inicio del código.</span></label>
                <label className="text-sm font-semibold">Categoría<Input required maxLength={80} value={values.category} onChange={e => change("category", e.target.value)} className="mt-2 font-normal" placeholder="Ej. Medicamentos, alimento, aseo" /></label>
                <label className="text-sm font-semibold">Presentación de una unidad<Input required disabled={fixedPresentation} maxLength={80} value={values.presentation} onChange={e => change("presentation", e.target.value)} className="mt-2 font-normal" placeholder="Ej. Frasco de 250 ml" /></label>
              </div>
              <p className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">1 unidad = {values.presentation.trim() || "una presentación completa: frasco, bolsa o caja"}. Por ejemplo, 3 frascos de 250 ml se registran como 3 unidades.</p>
            </section>
            <fieldset className="rounded-xl border p-4"><legend className="px-2 text-sm font-semibold">Áreas donde se utiliza</legend><p className="mb-3 text-xs text-muted-foreground">Selecciona una o varias áreas de tu establecimiento.</p><div className="flex flex-wrap gap-3">{(["retail", "veterinary", "grooming"] as ProductUse[]).filter(u => access?.activeModules.includes(u) || uses.includes(u)).map(u => <label key={u} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${uses.includes(u) ? "border-teal-200 bg-teal-50 text-teal-900" : ""}`}><input type="checkbox" className="size-4 accent-teal-700" checked={uses.includes(u)} onChange={e => setUses(list => e.target.checked ? [...list, u] : list.filter(x => x !== u))} />{USE_NAMES[u]}</label>)}</div>{!uses.length && <p className="mt-3 text-xs text-amber-900">Selecciona al menos un área para guardar el producto.</p>}</fieldset>
            <section aria-labelledby="product-prices" className="border-t pt-5"><h2 id="product-prices" className="mb-4 flex items-center gap-2 font-semibold"><BadgeDollarSign className="size-5 text-primary" />Costos y precio de venta</h2><div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Costo de referencia por unidad (COP)<Input required inputMode="decimal" value={values.referenceCost} onChange={e => change("referenceCost", e.target.value)} className="mt-2 font-normal" placeholder="Ej. 12000" /><MoneyHint value={values.referenceCost} /><span className="mt-1 block text-xs font-normal text-muted-foreground">Visible solo para administración.</span></label>
              {uses.includes("retail") && <label className="text-sm font-semibold">Precio de venta por unidad (COP)<Input required inputMode="decimal" value={values.salePrice} onChange={e => change("salePrice", e.target.value)} className="mt-2 font-normal" placeholder="Ej. 18000" /><MoneyHint value={values.salePrice} /></label>}
            </div></section>
            <section aria-labelledby="product-control" className="border-t pt-5"><h2 id="product-control" className="mb-4 flex items-center gap-2 font-semibold"><Boxes className="size-5 text-primary" />Control de existencias</h2><div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Mínimo para reposición (unidades)<Input required type="number" min={0} max={2147483647} step={1} value={values.stockMinimum} onChange={e => change("stockMinimum", e.target.value)} className="mt-2 font-normal" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Se avisa cuando las unidades disponibles llegan a este mínimo o quedan por debajo.</span></label>
              <label className="text-sm font-semibold">Seguimiento del producto<select disabled={fixedPresentation} value={values.lotPolicy} onChange={e => change("lotPolicy", e.target.value)} className={selectClass}><option value="untracked">Sin lote</option><option value="lot">Por lote</option><option value="lot_expiry">Por lote y vencimiento</option></select><span className="mt-1 block text-xs font-normal text-muted-foreground">{values.lotPolicy === "lot_expiry" ? "Cada entrada requiere lote y fecha de vencimiento." : values.lotPolicy === "lot" ? "Cada entrada requiere un código de lote." : "Las entradas se registran sin código de lote."}</span></label>
            </div>{fixedPresentation && <p className="mt-3 text-xs text-muted-foreground">La presentación y el seguimiento ya tienen movimientos asociados y se conservan para mantener el historial.</p>}</section>
          </fieldset>
        </div>
        <DialogFooter className="shrink-0 border-border"><Button type="button" variant="outline" onClick={onClose}>{saved ? "Cerrar" : "Cancelar"}</Button>{!saved && <Button type="submit" disabled={locked || !operation.ready || !uses.length}>{operation.busy ? "Guardando…" : product ? "Guardar cambios" : "Guardar producto"}</Button>}</DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
