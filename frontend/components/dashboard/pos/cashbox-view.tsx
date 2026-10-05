import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCcw,
} from "lucide-react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/transactions";
import { formatPosMoney } from "@/lib/pos-checkout";
import { validHistoryRange } from "@/lib/pos-history";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/expenses";
import { getPetEmoji } from "@/lib/pets";
import { CashboxExpenses, type CashboxExpense } from "./cashbox-expenses";

type CashboxTransaction = {
  id: string;
  clientName: string | null;
  petName: string | null;
  petType: string | null;
  total: number;
  paymentMethod: string;
  notes: string | null;
  paidAt: string;
  items: { description: string; quantity: number; total: number }[];
};

type CashboxData = {
  date: string;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
  expenseCount: number;
  incomeByMethod: { method: string; count: number; total: number }[];
  expensesByCategory: { category: string; count: number; total: number }[];
  transactions: CashboxTransaction[];
  expenses: CashboxExpense[];
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NetCard({ total, label, color, icon: Icon }: {
  total: number;
  label: string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-5 ${color}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="break-words text-3xl font-bold tabular-nums tracking-tight">{formatPosMoney(total)}</p>
    </div>
  );
}

export async function CashboxView({ date, tenant }: { date?: string; tenant?: string }) {
  const bogotaToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 10);
  const effectiveDate = date && validHistoryRange(date, date) && date <= bogotaToday ? date : bogotaToday;

  function posHref(tab: string, day?: string) {
    const params = new URLSearchParams({ tab });
    if (day) params.set("date", day);
    if (tenant) params.set("tenant", tenant);
    return `/dashboard/pos?${params}`;
  }

  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  let data: CashboxData | null = null;
  try {
    const res = await fetch(apiUrl(`/api/dashboard/metrics/cashbox?date=${effectiveDate}`), {
      cache: "no-store",
      headers,
    });
    if (res.ok) data = await res.json() as CashboxData;
  } catch { /* Se muestra un estado de error. */ }

  if (!data) {
    const params = new URLSearchParams({ tab: "caja", date: effectiveDate });
    if (tenant) params.set("tenant", tenant);
    return (
      <div role="alert" className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        <h3 className="font-semibold">No se pudo cargar la caja</h3>
        <p className="mt-1">No podemos mostrar los movimientos del día. Comprueba la conexión e inténtalo de nuevo.</p>
        <Link href={`/dashboard/pos?${params.toString()}`} className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-amber-300 bg-white px-4 font-semibold hover:bg-amber-100">Reintentar</Link>
      </div>
    );
  }

  const isToday = effectiveDate === bogotaToday;
  // The endpoint returns the full day's rows; use cents to preserve decimals
  // instead of its legacy rounded headline fields.
  const income = data.transactions.reduce((sum, row) => sum + Math.round(row.total * 100), 0) / 100;
  const expenses = data.expenses.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
  const net = (Math.round(income * 100) - Math.round(expenses * 100)) / 100;
  const dateLabel = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(effectiveDate + "T12:00:00-05:00"));

  return (
    <section className="mt-6 space-y-6 rounded-2xl border bg-white p-5 sm:p-6" aria-label="Resumen administrativo">
      <div><h3 className="text-lg font-bold">Resumen administrativo</h3><p className="mt-1 text-sm text-muted-foreground">Ingresos y gastos registrados del establecimiento. Consulta hoy o una fecha anterior.</p></div>
      {/* Fecha */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <p className="text-lg font-semibold">{dateLabel.charAt(0).toLocaleUpperCase("es") + dateLabel.slice(1)}</p>
          {isToday && <span className="text-xs font-medium text-primary">Hoy</span>}
        </div>
        <form action="/dashboard/pos" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value="caja" />
          {tenant && <input type="hidden" name="tenant" value={tenant} />}
          <label className="text-xs font-medium">Fecha del resumen<input aria-label="Fecha del resumen" type="date" name="date" defaultValue={effectiveDate} max={bogotaToday} required className="mt-1 block h-10 rounded-lg border bg-white px-3 text-sm" /></label>
          <Button type="submit"><Search aria-hidden="true" />Consultar</Button>
        </form>
        <nav aria-label="Cambiar fecha del resumen" className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={posHref("caja", prevDay(effectiveDate))}>
              <ChevronLeft aria-hidden="true" />Día anterior
            </Link>
          </Button>
          {!isToday && (
            <Button asChild variant="outline">
              <Link href={posHref("caja", nextDay(effectiveDate))}>
                Día siguiente<ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          )}
          {!isToday && <Button asChild variant="outline"><Link href={posHref("caja")}><RotateCcw aria-hidden="true" />Volver a hoy</Link></Button>}
        </nav>
      </div>

      {/* Cards resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <NetCard
          total={income}
          label={`Ingresos · ${data.transactionCount} cobro${data.transactionCount !== 1 ? "s" : ""}`}
          color="border-emerald-500/20 bg-emerald-500/5 text-emerald-700"
          icon={ArrowUpRight}
        />
        <NetCard
          total={expenses}
          label={`Gastos · ${data.expenseCount} gasto${data.expenseCount !== 1 ? "s" : ""}`}
          color="border-rose-500/20 bg-rose-500/5 text-rose-700"
          icon={ArrowDownRight}
        />
        <div className={`flex flex-col gap-2 rounded-xl border p-5 ${net >= 0 ? "border-primary/20 bg-primary/5 text-primary" : "border-amber-500/20 bg-amber-500/5 text-amber-700"}`}>
          <div className="flex items-center gap-2">
            <Minus className="h-4 w-4" />
            <p className="text-sm font-medium">Diferencia del día</p>
          </div>
          <p className="break-words text-3xl font-bold tabular-nums tracking-tight">{formatPosMoney(net)}</p>
          <p className="text-xs">Ingresos − gastos</p>
        </div>
      </div>
      <details className="text-xs leading-relaxed text-muted-foreground"><summary className="cursor-pointer font-medium">Cómo se calcula el resumen</summary><p className="mt-2">Incluye los ingresos y gastos registrados de todos los medios de pago. Los servicios completados cuentan como ingresos aunque su método de pago esté por revisar. Esta diferencia no representa el efectivo físico de la caja ni la utilidad del negocio.</p></details>

      {/* Desglose por método + categoría */}
      {(!isToday || data.expenses.length > 0) && <div className={`grid gap-4 ${!isToday ? "md:grid-cols-2" : ""}`}>
        {/* Ingresos por método */}
        {!isToday && <div className="rounded-xl border border-black/[0.08] border-t-2 border-t-emerald-500/50 bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-700" />
            <p className="text-sm font-semibold">Métodos guardados en los ingresos</p>
          </div>
          {data.incomeByMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin ingresos en esta fecha.</p>
          ) : (
            <ul className="space-y-2">
              {data.incomeByMethod.map((row) => (
                <li key={row.method} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[row.method as PaymentMethod] ?? row.method}
                    <span className="ml-1.5 text-xs opacity-60">×{row.count}</span>
                  </span>
                  <span className="tabular-nums font-semibold text-emerald-700">{formatPosMoney(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Incluye métodos guardados por defecto. La confirmación del pago de hoy se revisa en la lista operativa.</p>
        </div>}

        {/* Gastos por categoría */}
        {data.expenses.length > 0 && <div className="rounded-xl border border-black/[0.08] border-t-2 border-t-rose-500/50 bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-rose-700" />
            <p className="text-sm font-semibold">Gastos por categoría</p>
          </div>
          {data.expensesByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin gastos en esta fecha.</p>
          ) : (
            <ul className="space-y-2">
              {data.expensesByCategory.map((row) => (
                <li key={row.category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {EXPENSE_CATEGORY_LABELS[row.category as ExpenseCategory] ?? row.category}
                    <span className="ml-1.5 text-xs opacity-60">×{row.count}</span>
                  </span>
                  <span className="tabular-nums font-semibold text-rose-700">{formatPosMoney(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>}
      </div>}

      {/* Transacciones + Gastos del día */}
      <div className={`grid gap-4 ${!isToday ? "lg:grid-cols-2" : ""}`}>
        {/* Cobros */}
        {!isToday && <div className="rounded-xl border border-black/[0.08] border-t-2 border-t-teal-500/50 bg-card">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3">
            <p className="text-sm font-semibold">Cobros del día</p>
            <Link
              href={posHref("venta")}
              className="text-xs font-medium text-primary/70 transition-colors hover:text-primary"
            >
              + Nuevo cobro
            </Link>
          </div>
          {data.transactions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sin cobros registrados.{" "}
              <Link href={posHref("venta")} className="text-primary hover:underline">
                Registrar →
              </Link>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-black/[0.04]">
                {data.transactions.map((tx) => (
                  <li key={tx.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          {tx.petName && <span>{getPetEmoji(tx.petType ?? "")}</span>}
                          <span className="break-words font-medium">{[tx.petName, tx.clientName].filter(Boolean).join(" · ") || "Venta de mostrador"}</span>
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                          {tx.items.map((item, i) => (
                            <p key={i} className="truncate text-xs text-muted-foreground">
                              {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.description}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums text-emerald-700">{formatPosMoney(tx.total)}</p>
                        <p className="text-[11px] text-muted-foreground">{formatTime(tx.paidAt)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-black/[0.06] px-5 py-3 text-sm font-semibold">
                <span className="text-muted-foreground">Total cobros</span>
                <span className="text-emerald-700 tabular-nums">{formatPosMoney(income)}</span>
              </div>
            </>
          )}
        </div>}

        <CashboxExpenses key={effectiveDate} expenses={data.expenses} expenseHref={posHref("egreso")} />
      </div>
    </section>
  );
}

function prevDay(ymd: string) {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function nextDay(ymd: string) {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
