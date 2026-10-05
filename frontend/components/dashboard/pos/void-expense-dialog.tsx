"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { formatPosMoney } from "@/lib/pos-checkout";
import type { CashboxExpense } from "./cashbox-expenses";

type VoidResult = { id: string; status: "voided"; voidReason: string; voidedAt: string };

export function VoidExpenseDialog({ expense, onClose }: { expense: CashboxExpense; onClose: () => void }) {
  const router = useRouter();
  const tenant = useTenant();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VoidResult | null>(null);
  const busy = useRef(false);
  const endpoint = `/api/dashboard/expenses/${encodeURIComponent(expense.id)}`;

  function confirmResult(payload: unknown): boolean {
    if (!payload || typeof payload !== "object") return false;
    const row = payload as VoidResult;
    if (row.id !== expense.id || row.status !== "voided" || typeof row.voidReason !== "string" || !Number.isFinite(Date.parse(row.voidedAt))) return false;
    setResult(row); setUncertain(false); setError(""); router.refresh(); return true;
  }

  async function verify() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(proxyUrl(`${endpoint}${tenantQuery(tenant)}`), { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const payload = await response.json();
      if (!response.ok) throw new Error();
      if (!confirmResult(payload)) {
        if (payload?.id !== expense.id || payload.status !== "active") throw new Error();
        setUncertain(false); setError("El gasto sigue activo. Puedes revisar el motivo y volver a solicitar su anulación.");
      }
    } catch { setError("No se pudo comprobar el estado. Revisa Caja o vuelve a consultar; no repitas la solicitud sin comprobarla."); }
    finally { busy.current = false; setSaving(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || uncertain || result) return;
    if (!reason.trim()) { setError("Escribe el motivo de la anulación."); return; }
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(proxyUrl(`${endpoint}/void${tenantQuery(tenant)}`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }), signal: AbortSignal.timeout(20_000) });
      const payload = await response.json().catch(() => null);
      if (!response.ok && [400, 401, 403, 404, 409, 422].includes(response.status)) { setError(payload?.error || "No se pudo anular el gasto."); return; }
      if (!response.ok || !confirmResult(payload)) throw new Error();
    } catch { setUncertain(true); setError("No pudimos confirmar la anulación. Comprueba su estado antes de repetirla."); }
    finally { busy.current = false; setSaving(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto" showClose={!saving} onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} onPointerDownOutside={event => { if (saving) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>{result ? "Gasto anulado" : "Anular gasto"}</DialogTitle><DialogDescription>{result ? "El registro se conserva como antecedente y ya no suma a los gastos activos." : "Se conserva el registro original con el motivo. Los gastos de un día cerrado no se pueden anular."}</DialogDescription></DialogHeader>
    <form noValidate onSubmit={submit}><div className="space-y-4 px-6 py-5"><div className="rounded-xl bg-muted/30 p-4"><p className="break-words font-semibold">{expense.description}</p><p className="mt-1 text-xl font-bold tabular-nums">{formatPosMoney(expense.amount)}</p><p className="mt-2 break-words text-sm text-muted-foreground">Responsable: {expense.responsible || "No registrado"}</p><p className="mt-2 break-all text-xs text-muted-foreground">Registro: {expense.id}</p></div>
      {result ? <div role="status"><p className="text-sm font-semibold">Motivo guardado</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{result.voidReason}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(result.voidedAt).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p></div> : <div><label htmlFor="expense-void-reason" className="mb-2 block text-sm font-medium">Motivo de anulación (obligatorio)</label><textarea id="expense-void-reason" required maxLength={2000} rows={3} disabled={saving || uncertain} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ej. El mismo gasto se registró dos veces" className="w-full rounded-lg border bg-white p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60" aria-describedby={error ? "expense-void-error" : undefined} /></div>}
      {error && <p id="expense-void-error" role="alert" className="text-sm text-destructive">{error}</p>}
    </div><DialogFooter className="flex-wrap">{result ? <Button type="button" onClick={onClose}>Cerrar</Button> : <><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cerrar</Button>{uncertain ? <Button type="button" variant="outline" disabled={saving} onClick={verify}>{saving ? "Comprobando…" : "Comprobar anulación"}</Button> : <Button type="submit" variant="destructive" disabled={saving}>{saving ? "Anulando…" : "Confirmar anulación"}</Button>}</>}</DialogFooter></form>
  </DialogContent></Dialog>;
}
