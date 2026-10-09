"use client";

import { ClipboardList, PackagePlus, Pencil, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPosMoney as formatMoney } from "@/lib/pos-checkout";
import { inventoryDate, stockLabel } from "@/lib/inventory-display";
import { MOVEMENT_NAMES, USE_NAMES, type InventoryProduct, type InventoryMovement } from "@/lib/inventory";

type Props = {
  product: InventoryProduct; manage: boolean; cash: boolean; disabled: boolean;
  movements: InventoryMovement[]; historyBusy: boolean; historyError: string; hasMore: boolean;
  onClose: () => void; onEdit: () => void; onEntry: () => void; onCount: () => void;
  onToggleActive: () => void; onRetry: () => void; onMore: () => void;
  onCorrect: (movement: InventoryMovement) => void;
};
const date = (value: string) => new Date(value).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" });
const policies = { untracked: "Sin lote", lot: "Por lote", lot_expiry: "Por lote y vencimiento" };
const formatPosMoney = (value: string | number) => formatMoney(Number(value));

export function ProductDetail({ product: p, manage, cash, disabled, movements, historyBusy, historyError, hasMore, onClose, onEdit, onEntry, onCount, onToggleActive, onRetry, onMore, onCorrect }: Props) {
  const status = stockLabel(p);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl flex-col overflow-hidden border-border bg-white shadow-xl">
      <DialogHeader className="shrink-0 border-border pr-12">
        <DialogTitle className="break-words text-xl sm:text-2xl">{p.name}</DialogTitle>
        <DialogDescription className="break-words">{p.internalCode} · {p.presentation}</DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="summary" className="min-h-0 gap-0">
        <div className="shrink-0 border-b px-6 py-3"><TabsList aria-label="Información del producto" className="h-11 w-full sm:w-auto">
          <TabsTrigger value="summary" className="px-2 text-xs sm:px-4 sm:text-sm">Resumen</TabsTrigger>
          <TabsTrigger value="lots" className="px-2 text-xs sm:px-4 sm:text-sm">Lotes ({p.lots.length})</TabsTrigger>
          {manage && <TabsTrigger value="movements" className="px-2 text-xs sm:px-4 sm:text-sm">Movimientos</TabsTrigger>}
        </TabsList></div>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <TabsContent value="summary" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-teal-50 p-5">
              <div><p className="text-sm text-muted-foreground">Disponibles para vender o utilizar</p><p className="mt-1 text-3xl font-bold tabular-nums">{p.available} <span className="text-sm font-normal">unidades</span></p></div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${status.tone === "warning" ? "bg-amber-100 text-amber-900" : status.tone === "good" ? "bg-white text-teal-800" : "bg-muted text-muted-foreground"}`}>{status.text}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
              {[["Saldo físico", `${p.physical} unidades`], ["Unidades vencidas", p.expired], ["Mínimo para reposición", `${p.stockMinimum} unidades`], ["Categoría", p.category], ["Presentación / 1 unidad", p.presentation], ["Control", policies[p.lotPolicy]], ["Uso", p.uses.map(u => USE_NAMES[u]).join(", ")], ["Código de barras", p.barcode || "Sin registrar"], ...(cash ? [["Precio de venta", p.salePrice != null ? formatPosMoney(p.salePrice) : "Sin precio"]] : []), ...(manage ? [["Costo de referencia", formatPosMoney(p.referenceCost ?? 0)]] : [])].map(([label, value]) => <div key={label} className="min-w-0 border-b pb-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
            </dl>
            <p className="text-sm text-muted-foreground">El saldo físico incluye las unidades vencidas. Estas se conservan en el historial y no están disponibles para vender o utilizar.</p>
          </TabsContent>
          <TabsContent value="lots" className="space-y-3">
            <h2 className="font-semibold">Existencias por lote</h2>
            {!p.lots.length ? <div className="rounded-xl border border-dashed p-6 text-center"><p className="font-medium">Todavía no hay entradas</p><p className="mt-2 text-sm text-muted-foreground">Registra las unidades recibidas para comenzar a controlar las existencias.</p></div> : p.lots.map(l => {
              const expired = !!l.expiresOn && l.physical > 0 && l.available === 0;
              return <article key={l.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{l.lotCode ?? "Sin lote"}</h3><p className="mt-1 text-sm text-muted-foreground">{l.expiresOn ? `Vence el ${inventoryDate(l.expiresOn)}` : "Sin fecha de vencimiento"}</p></div>{expired ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-800">Vencido</span> : l.expiresSoon && l.physical > 0 ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Vence en 30 días</span> : null}</div><dl className="mt-4 flex gap-8 text-sm"><div><dt className="text-muted-foreground">Disponibles</dt><dd className="font-bold tabular-nums">{l.available}</dd></div><div><dt className="text-muted-foreground">Físicas</dt><dd className="font-medium tabular-nums">{l.physical}</dd></div></dl></article>;
            })}
          </TabsContent>
          {manage && <TabsContent value="movements" className="space-y-4">
            <div><h2 className="font-semibold">Historial de movimientos</h2><p className="mt-1 text-sm text-muted-foreground">Entradas y salidas con fecha, responsable y motivo. Las correcciones conservan el registro original.</p></div>
            {historyError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{historyError}<Button size="sm" variant="outline" className="ml-2" disabled={historyBusy} onClick={onRetry}>Reintentar</Button></div>}
            {movements.map(m => <article key={m.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><span className={`rounded-lg p-2 ${m.stockDelta > 0 ? "bg-teal-50 text-teal-800" : "bg-muted text-muted-foreground"}`}>{m.stockDelta > 0 ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span><div><h3 className="font-semibold">{MOVEMENT_NAMES[m.kind] ?? m.kind}</h3><p className="mt-1 text-xs text-muted-foreground">{date(m.occurredAt)} · {m.actorName}</p></div></div><div className="text-right"><p className="font-bold tabular-nums">{m.stockDelta > 0 ? "+" : ""}{m.stockDelta} unidades</p><p className="mt-1 text-xs text-muted-foreground">Saldo del lote: {m.balanceAfter}</p></div></div><p className="mt-3 text-xs text-muted-foreground">{m.lotCodeSnapshot ?? "Sin lote"} · {m.presentationSnapshot}{m.entryUnitCost != null ? ` · Costo unitario: ${formatPosMoney(m.entryUnitCost)}` : ""}</p>{m.reason && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.reason}</p>}{m.kind === "consumption" && <Button disabled={disabled} size="sm" variant="outline" className="mt-3" onClick={() => onCorrect(m)}>Corregir unidades no utilizadas</Button>}</article>)}
            {historyBusy && <p role="status" className="text-sm text-muted-foreground">Cargando movimientos…</p>}
            {!movements.length && !historyBusy && !historyError && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Sin movimientos registrados.</p>}
            {hasMore && <Button variant="outline" disabled={historyBusy} onClick={onMore}>Ver movimientos anteriores</Button>}
          </TabsContent>}
        </div>
      </Tabs>
      <DialogFooter className="shrink-0 flex-col items-stretch border-border sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {manage && <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {p.active && <Button aria-label="Registrar entrada" disabled={disabled} onClick={onEntry}><PackagePlus /><span className="sm:hidden">Entrada</span><span className="hidden sm:inline">Registrar entrada</span></Button>}
          <Button variant="outline" disabled={disabled} onClick={onEdit}><Pencil />Editar</Button>
          <Button aria-label="Conteo físico" aria-describedby={!p.lots.length ? "inventory-count-help" : undefined} variant="outline" disabled={disabled || !p.lots.length} onClick={onCount}><ClipboardList /><span className="sm:hidden">Conteo</span><span className="hidden sm:inline">Conteo físico</span></Button>
          <Button variant="ghost" disabled={disabled} onClick={onToggleActive}>{p.active ? "Desactivar" : "Activar"}</Button>
        </div>}
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
        {manage && !p.lots.length && <p id="inventory-count-help" className="w-full text-xs text-muted-foreground">{p.active ? "Registra una entrada para poder contar las existencias." : "Activa el producto y registra una entrada para poder contar las existencias."}</p>}
        {manage && disabled && <p role="status" className="w-full text-xs text-muted-foreground">Actualizando el producto. Las acciones estarán disponibles al terminar.</p>}
        {manage && !p.active && <p className="w-full text-xs text-muted-foreground">El producto está desactivado. Actívalo para registrar nuevas entradas y usos.</p>}
        {manage && <p className="w-full text-xs text-muted-foreground">Desactivar conserva el historial y bloquea nuevos usos.</p>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
