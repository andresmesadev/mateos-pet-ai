import Link from "next/link";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import {
  type Transaction,
  type PaymentMethod,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ICONS,
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

type PageProps = {
  searchParams: Promise<{ period?: string; tenant?: string }>;
};

function prevPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function nextPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function periodLabel(p: string) {
  const [y, m] = p.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function currentPeriod() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7);
}

export default async function RevenuePage({ searchParams }: PageProps) {
  const { period: rawPeriod, tenant } = await searchParams;
  const period = rawPeriod && /^\d{4}-\d{2}$/.test(rawPeriod) ? rawPeriod : currentPeriod();

  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  // Fetch metrics + today's transactions in parallel
  const todayYmd = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 10);
  const [metricsRes, todayRes] = await Promise.all([
    fetch(apiUrl(`/api/dashboard/metrics/revenue?period=${period}`), { cache: "no-store", headers }),
    fetch(apiUrl(`/api/dashboard/transactions?from=${todayYmd}&to=${todayYmd}`), { cache: "no-store", headers }),
  ]);

  const metrics: RevenueMetrics = metricsRes.ok ? await metricsRes.json() : {
    period, totalCurrent: 0, totalPrev: 0, delta: 0, transactionCount: 0, byItem: [], byMethod: [],
  };
  const todayTx: Transaction[] = todayRes.ok ? await todayRes.json() : [];

  const prev = prevPeriod(period);
  const next = nextPeriod(period);
  const isCurrent = period === currentPeriod();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ingresos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Historial de cobros y resumen mensual.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/pos">+ Nueva venta</Link>
        </Button>
      </div>

      {/* Period nav */}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/dashboard/revenue?period=${prev}`}>← {periodLabel(prev)}</Link>
        </Button>
        <span className="font-semibold text-sm flex-1 text-center">{periodLabel(period)}</span>
        {!isCurrent && (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/dashboard/revenue?period=${next}`}>{periodLabel(next)} →</Link>
          </Button>
        )}
        {isCurrent && <div className="w-24" />}
      </div>

      {/* Total del mes */}
      <Card className="border-2 border-green-200 bg-green-50/40 dark:border-green-900 dark:bg-green-950/10">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total {periodLabel(period)}</p>
              <p className="text-4xl font-bold">{formatCOP(metrics.totalCurrent)}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{metrics.transactionCount} cobro{metrics.transactionCount === 1 ? "" : "s"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">vs {periodLabel(prev)}</p>
              <p className={`text-2xl font-bold ${metrics.delta >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {metrics.delta >= 0 ? "▲" : "▼"} {formatCOP(Math.abs(metrics.delta))}
              </p>
              <p className="text-sm text-muted-foreground">{formatCOP(metrics.totalPrev)} mes anterior</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Por servicio */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Por servicio</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.byItem.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin cobros este mes.</p>
            ) : (
              <ul className="divide-y">
                {metrics.byItem.map((row) => (
                  <li key={row.description} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-medium">{row.description}</span>
                      <span className="ml-2 text-xs text-muted-foreground">× {row.quantity}</span>
                    </div>
                    <span className="font-semibold tabular-nums">{formatCOP(row.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Por método de pago */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Por método de pago</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.byMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin cobros este mes.</p>
            ) : (
              <ul className="divide-y">
                {metrics.byMethod.map((row) => {
                  const icon = PAYMENT_METHOD_ICONS[row.method as PaymentMethod] ?? "🔖";
                  const label = PAYMENT_METHOD_LABELS[row.method as PaymentMethod] ?? row.method;
                  return (
                    <li key={row.method} className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{icon}</span>
                        <span className="font-medium">{label}</span>
                        <Badge variant="outline" className="text-xs">{row.count}</Badge>
                      </div>
                      <span className="font-semibold tabular-nums">{formatCOP(row.total)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Caja de hoy */}
      {isCurrent && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Caja de hoy
              <Badge variant="outline">{todayTx.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayTx.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin cobros hoy. <Link href="/dashboard/pos" className="underline">Registrar venta →</Link></p>
            ) : (
              <ul className="divide-y">
                {todayTx.map((tx) => (
                  <li key={tx.id} className="py-2.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {tx.petName && <span>{getPetEmoji(tx.petType ?? "")} <span className="font-medium">{tx.petName}</span></span>}
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
                        <p className="font-bold">{formatCOP(tx.total)}</p>
                        <p className="text-xs text-muted-foreground">
                          {PAYMENT_METHOD_ICONS[tx.paymentMethod]} {PAYMENT_METHOD_LABELS[tx.paymentMethod]}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatTransactionDate(tx.paidAt)}</p>
                  </li>
                ))}
              </ul>
            )}
            {todayTx.length > 0 && (
              <div className="mt-3 border-t pt-3 flex justify-between text-sm font-semibold">
                <span>Total hoy</span>
                <span>{formatCOP(todayTx.reduce((s, t) => s + t.total, 0))}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
