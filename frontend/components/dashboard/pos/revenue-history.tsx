import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  type Transaction,
  type PaymentMethod,
  PAYMENT_METHOD_LABELS,
  formatCOP,
  formatTransactionDate,
} from "@/lib/transactions";
import { getPetEmoji } from "@/lib/pets";

type RevenueMetrics = {
  period: string;
  totalCurrent: number;
  totalPrev: number;
  delta: number;
  transactionCount: number;
  byItem: { description: string; quantity: number; total: number }[];
  byMethod: { method: string; count: number; total: number }[];
};

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function periodLabel(p: string) {
  const [y, m] = p.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
function prevPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function nextPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
function currentPeriod() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7);
}

const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  cash: "💵", transfer: "🏦", card: "💳", other: "🔖",
};

export async function RevenueHistory({ period: rawPeriod, tenant }: { period?: string; tenant?: string }) {
  const period = rawPeriod && /^\d{4}-\d{2}$/.test(rawPeriod) ? rawPeriod : currentPeriod();
  const isCurrent = period === currentPeriod();

  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  const todayYmd = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 10);
  const [metricsRes, todayRes] = await Promise.all([
    fetch(apiUrl(`/api/dashboard/metrics/revenue?period=${period}`), { cache: "no-store", headers }),
    isCurrent
      ? fetch(apiUrl(`/api/dashboard/transactions?from=${todayYmd}&to=${todayYmd}`), { cache: "no-store", headers })
      : Promise.resolve(null),
  ]);

  const metrics: RevenueMetrics = metricsRes.ok
    ? await metricsRes.json()
    : { period, totalCurrent: 0, totalPrev: 0, delta: 0, transactionCount: 0, byItem: [], byMethod: [] };
  const todayTx: Transaction[] = isCurrent && todayRes?.ok ? await todayRes.json() : [];

  const prev = prevPeriod(period);
  const next = nextPeriod(period);

  return (
    <div className="space-y-6">
      {/* Period nav */}
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/pos?tab=historial&period=${prev}`}
          className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <ChevronLeft className="h-4 w-4" />
          {periodLabel(prev)}
        </Link>
        <span className="flex-1 text-center text-sm font-semibold">{periodLabel(period)}</span>
        {!isCurrent ? (
          <Link
            href={`/dashboard/pos?tab=historial&period=${next}`}
            className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            {periodLabel(next)}
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <div className="w-28" />
        )}
      </div>

      {/* Total del mes */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex flex-wrap items-end gap-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Total {periodLabel(period)}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-emerald-300">
              {formatCOP(metrics.totalCurrent)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {metrics.transactionCount} cobro{metrics.transactionCount !== 1 ? "s" : ""}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              vs {periodLabel(prev)}
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${metrics.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {metrics.delta >= 0 ? "▲" : "▼"} {formatCOP(Math.abs(metrics.delta))}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{formatCOP(metrics.totalPrev)} mes anterior</p>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-card p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Por servicio</p>
          {metrics.byItem.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cobros este mes.</p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {metrics.byItem.map((row) => (
                <li key={row.description} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{row.description}</span>
                    <span className="ml-2 text-xs text-muted-foreground">×{row.quantity}</span>
                  </div>
                  <span className="tabular-nums font-semibold">{formatCOP(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-card p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Por método de pago</p>
          {metrics.byMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cobros este mes.</p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {metrics.byMethod.map((row) => {
                const icon = PAYMENT_METHOD_ICONS[row.method as PaymentMethod] ?? "🔖";
                const label = PAYMENT_METHOD_LABELS[row.method as PaymentMethod] ?? row.method;
                return (
                  <li key={row.method} className="flex items-center justify-between py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{icon}</span>
                      <span className="font-medium">{label}</span>
                      <Badge variant="outline" className="text-[10px]">{row.count}</Badge>
                    </div>
                    <span className="tabular-nums font-semibold">{formatCOP(row.total)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Transacciones de hoy (solo mes actual) */}
      {isCurrent && (
        <div className="rounded-xl border border-white/[0.06] bg-card">
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3">
            <p className="text-sm font-semibold">Cobros de hoy</p>
            <Badge variant="outline">{todayTx.length}</Badge>
          </div>
          {todayTx.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sin cobros hoy.{" "}
              <Link href="/dashboard/pos?tab=venta" className="text-primary hover:underline">
                Registrar venta →
              </Link>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-white/[0.04]">
                {todayTx.map((tx) => (
                  <li key={tx.id} className="px-5 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {tx.petName && <span>{getPetEmoji(tx.petType ?? "")}</span>}
                          {tx.petName && <span className="font-medium">{tx.petName}</span>}
                          {tx.clientName && <span className="text-muted-foreground">· {tx.clientName}</span>}
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                          {tx.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                              <span>{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.description}</span>
                              <span className="tabular-nums">{formatCOP(item.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold tabular-nums">{formatCOP(tx.total)}</p>
                        <p className="text-xs text-muted-foreground">
                          {PAYMENT_METHOD_ICONS[tx.paymentMethod as PaymentMethod]}{" "}
                          {PAYMENT_METHOD_LABELS[tx.paymentMethod as PaymentMethod]}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatTransactionDate(tx.paidAt)}</p>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-white/[0.06] px-5 py-3 text-sm font-semibold">
                <span className="text-muted-foreground">Total hoy</span>
                <span className="tabular-nums">{formatCOP(todayTx.reduce((s, t) => s + t.total, 0))}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
