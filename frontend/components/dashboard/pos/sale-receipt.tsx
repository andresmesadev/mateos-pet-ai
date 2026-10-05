"use client";

import { createPortal } from "react-dom";
import { Printer, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAYMENT_METHOD_LABELS, formatTransactionDate, type Transaction } from "@/lib/transactions";
import { formatPosMoney } from "@/lib/pos-checkout";
import { HISTORY_ORIGIN_LABELS, transactionNeedsReview } from "@/lib/pos-history";

export function SaleReceipt({ transaction, cash }: { transaction: Transaction; cash?: { received: number; change: number } }) {
  const review = transactionNeedsReview(transaction);
  return <article className="space-y-5 text-sm">
    {transaction.status === "voided" && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900"><p className="font-bold">VENTA ANULADA</p><p className="mt-1 whitespace-pre-wrap break-words">{transaction.voidReason}</p>{transaction.voidedAt && <p className="mt-1 text-xs">{formatTransactionDate(transaction.voidedAt)}</p>}<p className="mt-2 text-xs">Importe original conservado para consulta. Excluido de los ingresos.</p></div>}
    <div className="border-b border-dashed pb-4"><h3 className="text-xl font-bold">{review ? "Comprobante de operación" : "Comprobante de cobro"}</h3><p className="mt-1 text-muted-foreground">{formatTransactionDate(transaction.paidAt)}</p><p className="mt-1 text-muted-foreground">{HISTORY_ORIGIN_LABELS[transaction.origin || "legacy"]}</p><p className="mt-2 break-all text-xs text-muted-foreground">Referencia: {transaction.id}</p></div>
    <dl className="space-y-2"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Cliente</dt><dd className="text-right font-medium">{transaction.clientName || transaction.clientPhone || "Venta de mostrador"}</dd></div>{transaction.petName && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Mascota</dt><dd>{transaction.petName}</dd></div>}</dl>
    <table className="w-full text-left"><thead className="border-b text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">Artículo / cantidad</th><th className="pb-2 text-right font-medium">Importe</th></tr></thead><tbody>{transaction.items.map(item => <tr key={item.id} className="border-b border-dashed"><td className="py-3 pr-3"><p className="break-words font-medium">{item.description}</p>{item.productId && <p className="mt-1 break-words text-xs text-muted-foreground">{[item.productCode, item.presentation].filter(Boolean).join(" · ")}</p>}<p className="mt-1 text-xs text-muted-foreground">{item.quantity} × {formatPosMoney(item.unitPrice)}</p>{item.inventoryReturn && <p className="mt-1 text-xs text-emerald-800">Devolución: {item.inventoryReturn.quantity} unidades · {item.inventoryReturn.disposition === "restock" ? "Repuestas en inventario" : "Recibidas sin reposición"}</p>}</td><td className="py-3 text-right align-top tabular-nums">{formatPosMoney(item.total)}</td></tr>)}</tbody></table>
    <div className="flex items-center justify-between gap-3 text-xl font-bold"><span>Total COP</span><span className="tabular-nums">{formatPosMoney(transaction.total)}</span></div>
    <dl className="space-y-2 border-t pt-4"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Método de pago</dt><dd className="font-medium">{review ? "Por revisar en Caja diaria" : PAYMENT_METHOD_LABELS[transaction.paymentMethod]}</dd></div>{cash && !review && transaction.paymentMethod === "cash" && <><div className="flex justify-between"><dt>Efectivo recibido</dt><dd>{formatPosMoney(cash.received)}</dd></div><div className="flex justify-between font-semibold"><dt>Cambio</dt><dd>{formatPosMoney(cash.change)}</dd></div></>}{transaction.recordedBy?.name && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Registró</dt><dd className="text-right">{transaction.recordedBy.name}</dd></div>}</dl>
    {transaction.notes && <p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3">{transaction.notes}</p>}
    <p className="border-t pt-4 text-center text-xs text-muted-foreground">Comprobante interno de la operación. No es una factura electrónica.</p>
  </article>;
}

export function ReceiptDialog({ transaction, onClose, cash }: { transaction: Transaction | null; onClose: () => void; cash?: { received: number; change: number } }) {
  return <>
    <Dialog open={!!transaction} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto border-border bg-white shadow-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" />Detalle de operación</DialogTitle><DialogDescription>Consulta los datos guardados de esta operación.</DialogDescription></DialogHeader>
        {transaction && <div className="p-6"><SaleReceipt transaction={transaction} cash={cash} /><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cerrar</Button><Button type="button" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir</Button></div></div>}
      </DialogContent>
    </Dialog>
    {transaction && createPortal(<div data-pos-print="true" className="hidden"><style>{`@media print { body > *:not([data-pos-print]) { display: none !important; } body > [data-pos-print] { display: block !important; max-width: 80mm; padding: 4mm; margin: 0 auto; color: #111; background: white; } @page { margin: 10mm; } }`}</style><SaleReceipt transaction={transaction} cash={cash} /></div>, document.body)}
  </>;
}
