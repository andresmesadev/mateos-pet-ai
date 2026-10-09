"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { useInventoryOperation } from "@/lib/use-inventory-operation";
export function InventoryOperationStatus({ operation, focusFeedback = false }: { operation: ReturnType<typeof useInventoryOperation>; focusFeedback?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focusFeedback && operation.message) ref.current?.focus(); }, [focusFeedback, operation.message]);
  return <div ref={ref} data-inventory-feedback tabIndex={focusFeedback ? -1 : undefined} aria-live="polite" className="space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">{operation.message && <p role="status" className="rounded-xl border bg-muted p-3 text-sm">{operation.message}</p>}{operation.pending.map(p => <div key={p.key} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">Resultado por comprobar · {p.label}</p><p className="mt-1 text-amber-900">Conservamos los datos enviados. Consulta el resultado o reintenta con la misma clave. Cerrar esta ventana no cancela la operación; podrás comprobarla al volver al inventario.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" className="min-h-11" size="sm" variant="outline" disabled={operation.busy} onClick={()=>void operation.recover(p)}>Consultar resultado</Button><Button type="button" className="min-h-11" size="sm" disabled={operation.busy} onClick={()=>void operation.retry(p)}>Reintentar operación</Button></div></div>)}</div>;
}
