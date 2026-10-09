"use client";

import { useRef, useState } from "react";
import { Package, BadgeDollarSign, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProtectedDialog, useDialogEditGuard } from "../protected-dialog";
import { FormDialogContent, FormDialogHeader, FormDialogBody, FormDialogFooter, FormSection, FormAdditional } from "../form-layout";
import { FieldError, useFormFeedback } from "../form-feedback";
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

type Props = { product?: InventoryProduct; onClose: () => void; onSaved: () => void | Promise<void> };
function ProductFormContent({ product, onClose, onSaved }: Props) {
  const access = useDashboardAccess();
  const feedback = useFormFeedback();
  const submittedKey = useRef<string | null>(null);
  const [preparedKey, setPreparedKey] = useState<string | null>(null);
  const [values, setValues] = useState({ name: product?.name ?? "", internalCode: product?.internalCode ?? "", barcode: product?.barcode ?? "", category: product?.category ?? "", presentation: product?.presentation ?? "", referenceCost: String(product?.referenceCost ?? ""), salePrice: String(product?.salePrice ?? ""), stockMinimum: String(product?.stockMinimum ?? 0), lotPolicy: product?.lotPolicy ?? "untracked" });
  const [uses, setUses] = useState<ProductUse[]>(product?.uses ?? []), [saved, setSaved] = useState(false);
  const [initial] = useState(values);
  const operation = useInventoryOperation(async confirmed => { if (confirmed.key === submittedKey.current) setSaved(true); await onSaved(); }, prepared => { submittedKey.current = prepared.key; setPreparedKey(prepared.key); });
  const locked = operation.busy || operation.pending.length > 0 || saved;
  const fixedPresentation = !!product && product.stockRevision > 0;
  const ownPending = operation.pending.some(p => p.key === preparedKey);
  const dirty = !saved && !ownPending && ((Object.keys(values) as (keyof typeof values)[]).some(field => values[field] !== initial[field]) || [...uses].sort().join() !== [...(product?.uses ?? [])].sort().join());
  const discard = useDialogEditGuard(dirty, operation.busy);
  const change = (field: keyof typeof values, value: string) => { feedback.clearField(`product-${field}`); setValues(v => ({ ...v, [field]: value })); };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (locked || !operation.ready) return;
    const custom: Record<string, string> = {};
    if (!uses.length) custom["product-uses"] = "Selecciona al menos un área donde se utiliza.";
    for (const field of ["referenceCost", "salePrice"] as const) {
      const text = values[field].replace(",", ".");
      if ((field === "referenceCost" || uses.includes("retail") || text) && (!/^\d{1,8}(\.\d{1,2})?$/.test(text) || (field === "salePrice" && Number(text) === 0))) custom[`product-${field}`] = "Ingresa pesos sin separadores de miles, con máximo dos decimales; el precio de venta debe ser mayor que cero.";
    }
    if (!feedback.validate(e.currentTarget, { "product-name": "Escribe el nombre del producto.", "product-internalCode": "Escribe el código interno.", "product-category": "Escribe la categoría.", "product-presentation": "Indica qué contiene una unidad.", "product-stockMinimum": "Indica el mínimo de unidades para reposición." }, custom)) return;
    const ok = await operation.execute(product ? "update_product" : "create_product", `/api/dashboard/inventory/products${product ? "/" + product.id : ""}`, { ...values, barcode: values.barcode.trim() || null, salePrice: values.salePrice.trim().replace(",", ".") || null, referenceCost: values.referenceCost.replace(",", "."), stockMinimum: Number(values.stockMinimum), uses, ...(product ? { expectedVersion: product.metadataVersion } : {}) }, product ? `Editar ${product.name}` : "Nuevo producto", product ? "PATCH" : "POST");
    if (ok) setSaved(true);
  }
  return <FormDialogContent className="max-w-3xl border-border bg-background shadow-xl">
      <FormDialogHeader><DialogTitle className="text-xl">{product ? "Editar producto" : "Nuevo producto o insumo"}</DialogTitle><DialogDescription>Define qué producto es, cómo se utiliza y cómo controlar sus existencias.</DialogDescription></FormDialogHeader>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit} noValidate aria-busy={operation.busy}>
        <FormDialogBody>
          <InventoryOperationStatus operation={operation} focusFeedback />
          {saved && !product && <p className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900">Producto registrado. Ahora puedes ingresar las unidades recibidas desde el botón Entrada del listado.</p>}
          <fieldset disabled={locked} className="space-y-6">
            <FormSection title={<span className="inline-flex items-center gap-2"><Package className="size-5 text-primary" />Identificación del producto</span>}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold sm:col-span-2">Nombre<Input id="product-name" required maxLength={160} {...feedback.fieldProps("product-name")} value={values.name} onChange={e => change("name", e.target.value)} className="mt-2 font-normal" placeholder="Ej. Champú para piel sensible" /><FieldError id="product-name" message={feedback.errors["product-name"]} /></label>
                <label className="text-sm font-semibold">Código interno<Input id="product-internalCode" required maxLength={64} {...feedback.fieldProps("product-internalCode")} value={values.internalCode} onChange={e => change("internalCode", e.target.value)} className="mt-2 font-normal" placeholder="Ej. CH-001" /><FieldError id="product-internalCode" message={feedback.errors["product-internalCode"]} /></label>
                <label className="text-sm font-semibold">Categoría<Input id="product-category" required maxLength={80} {...feedback.fieldProps("product-category")} value={values.category} onChange={e => change("category", e.target.value)} className="mt-2 font-normal" placeholder="Ej. Medicamentos, alimento, aseo" /><FieldError id="product-category" message={feedback.errors["product-category"]} /></label>
                <label className="text-sm font-semibold">Presentación de una unidad<Input id="product-presentation" required disabled={fixedPresentation} maxLength={80} {...feedback.fieldProps("product-presentation")} value={values.presentation} onChange={e => change("presentation", e.target.value)} className="mt-2 font-normal" placeholder="Ej. Frasco de 250 ml" /><FieldError id="product-presentation" message={feedback.errors["product-presentation"]} /></label>
              </div>
              <p className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">1 unidad = {values.presentation.trim() || "una presentación completa: frasco, bolsa o caja"}. Por ejemplo, 3 frascos de 250 ml se registran como 3 unidades.</p>
            </FormSection>
            <fieldset className="min-w-0 rounded-xl border p-4"><legend className="px-2 text-sm font-semibold">Áreas donde se utiliza</legend><p className="mb-3 text-xs text-muted-foreground">Selecciona una o varias áreas de tu establecimiento.</p><div id="product-uses" tabIndex={-1} {...feedback.fieldProps("product-uses")} className="flex flex-wrap gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">{(["retail", "veterinary", "grooming"] as ProductUse[]).filter(u => access?.activeModules.includes(u) || uses.includes(u)).map(u => <label key={u} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${uses.includes(u) ? "border-teal-200 bg-teal-50 text-teal-900" : ""}`}><input id={`product-use-${u}`} type="checkbox" className="size-4 accent-teal-700" checked={uses.includes(u)} {...feedback.fieldProps("product-uses")} onChange={e => { feedback.clearField("product-uses"); setUses(list => e.target.checked ? [...list, u] : list.filter(x => x !== u)); }} />{USE_NAMES[u]}</label>)}</div><FieldError id="product-uses" message={feedback.errors["product-uses"]} /></fieldset>
            <FormSection title={<span className="inline-flex items-center gap-2"><BadgeDollarSign className="size-5 text-primary" />Costos y precio de venta</span>}><div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Costo de referencia por unidad (COP)<Input id="product-referenceCost" required inputMode="decimal" {...feedback.fieldProps("product-referenceCost")} value={values.referenceCost} onChange={e => change("referenceCost", e.target.value)} className="mt-2 font-normal" placeholder="Ej. 12000" /><FieldError id="product-referenceCost" message={feedback.errors["product-referenceCost"]} /><MoneyHint value={values.referenceCost} /><span className="mt-1 block text-xs font-normal text-muted-foreground">Visible solo para administración.</span></label>
              {(uses.includes("retail") || values.salePrice !== "") && <label className="text-sm font-semibold">Precio de venta por unidad (COP){!uses.includes("retail") && " (opcional)"}<Input id="product-salePrice" required={uses.includes("retail")} inputMode="decimal" {...feedback.fieldProps("product-salePrice")} value={values.salePrice} onChange={e => change("salePrice", e.target.value)} className="mt-2 font-normal" placeholder="Ej. 18000" /><FieldError id="product-salePrice" message={feedback.errors["product-salePrice"]} /><MoneyHint value={values.salePrice} /></label>}
            </div></FormSection>
            <FormSection title={<span className="inline-flex items-center gap-2"><Boxes className="size-5 text-primary" />Existencias y reposición</span>}><div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Mínimo para reposición (unidades)<Input id="product-stockMinimum" required type="number" min={0} max={2147483647} step={1} {...feedback.fieldProps("product-stockMinimum")} value={values.stockMinimum} onChange={e => change("stockMinimum", e.target.value)} className="mt-2 font-normal" /><FieldError id="product-stockMinimum" message={feedback.errors["product-stockMinimum"]} /><span className="mt-1 block text-xs font-normal text-muted-foreground">Se avisa cuando las unidades disponibles llegan a este mínimo o quedan por debajo.</span></label>
              <label className="text-sm font-semibold">Seguimiento del producto<select id="product-lotPolicy" disabled={fixedPresentation} value={values.lotPolicy} onChange={e => change("lotPolicy", e.target.value)} className={selectClass}><option value="untracked">Sin lote</option><option value="lot">Por lote</option><option value="lot_expiry">Por lote y vencimiento</option></select><span className="mt-1 block text-xs font-normal text-muted-foreground">{values.lotPolicy === "lot_expiry" ? "Cada entrada requiere lote y fecha de vencimiento." : values.lotPolicy === "lot" ? "Cada entrada requiere un código de lote." : "Las entradas se registran sin código de lote."}</span></label>
            </div>{fixedPresentation && <p className="mt-3 text-xs text-muted-foreground">La presentación y el seguimiento ya tienen movimientos asociados y se conservan para mantener el historial.</p>}</FormSection>
            <FormAdditional><label className="block text-sm font-semibold">Código de barras (opcional)<Input id="product-barcode" maxLength={80} value={values.barcode} onChange={e => change("barcode", e.target.value)} className="mt-2 font-normal" placeholder="Escanea o escribe el código" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Se conservan los ceros al inicio del código.</span></label></FormAdditional>
          </fieldset>
        </FormDialogBody>
        <FormDialogFooter><Button type="button" variant="outline" disabled={operation.busy} onClick={() => discard(onClose)}>{saved || ownPending ? "Cerrar" : "Cancelar"}</Button>{!saved && <Button type="submit" disabled={locked || !operation.ready}>{operation.busy ? "Guardando…" : product ? "Guardar cambios" : "Guardar producto"}</Button>}</FormDialogFooter>
      </form>
    </FormDialogContent>;
}

export function ProductForm(props: Props) {
  return <ProtectedDialog open onOpenChange={open => { if (!open) props.onClose(); }}><ProductFormContent {...props} /></ProtectedDialog>;
}
