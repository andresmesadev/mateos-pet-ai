'use client';
import { Input } from '@/components/ui/input';
import { formatPosMoney, moneyInCents } from '@/lib/pos-checkout';

export function MixedPaymentFields({ totalCents, cash, transfer, onCash, onTransfer }: { totalCents: number; cash: string; transfer: string; onCash: (value: string) => void; onTransfer: (value: string) => void }) {
  const sum = (moneyInCents(cash) ?? 0) + (moneyInCents(transfer) ?? 0);
  return <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
    <label className="block text-sm font-medium">Parte en efectivo (COP)<Input id="pos-mixed-cash" inputMode="decimal" maxLength={30} value={cash} onChange={e => onCash(e.target.value)} className="mt-2" placeholder="Ej. 30000" /></label>
    <label className="block text-sm font-medium">Parte en transferencia (COP)<Input id="pos-mixed-transfer" inputMode="decimal" maxLength={30} value={transfer} onChange={e => onTransfer(e.target.value)} className="mt-2" placeholder="Ej. 20000" /></label>
    <p role="status" className={`text-xs ${sum === totalCents ? 'text-primary' : 'text-amber-800'}`}>Asignado: {formatPosMoney(sum / 100)} de {formatPosMoney(totalCents / 100)}.</p>
    <p className="text-xs text-muted-foreground">Verifica la transferencia antes de confirmar el cobro.</p>
  </div>;
}
