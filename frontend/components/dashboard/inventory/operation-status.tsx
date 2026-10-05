"use client";
import { Button } from "@/components/ui/button";
import type { useInventoryOperation } from "@/lib/use-inventory-operation";
export function InventoryOperationStatus({ operation }: { operation: ReturnType<typeof useInventoryOperation> }) {
  return <div aria-live="polite" className="space-y-3">{operation.message && <p role="status" className="rounded-xl border bg-muted p-3 text-sm">{operation.message}</p>}{operation.pending.map(p => <div key={p.key} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">Resultado por comprobar · {p.label}</p><p className="mt-1 text-amber-900">Conservamos los datos enviados. Consulta el resultado o reintenta con la misma clave.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={operation.busy} onClick={()=>void operation.recover(p)}>Consultar resultado</Button><Button type="button" size="sm" disabled={operation.busy} onClick={()=>void operation.retry(p)}>Reintentar operación</Button></div></div>)}</div>;
}
