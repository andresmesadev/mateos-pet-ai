import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { formatCOP, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/transactions";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS, type ExpenseCategory } from "@/lib/expenses";
import { getPetEmoji } from "@/lib/pets";

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

type CashboxExpense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  date: string;
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
      <p className="text-3xl font-bold tabular-nums tracking-tight">{formatCOP(total)}</p>
    </div>
  );
}

export async function CashboxView({ date, tenant }: { date?: string; tenant?: string }) {
  const bogotaToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 10);
  const effectiveDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : bogotaToday;

  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  const res = await fetch(apiUrl(`/api/dashboard/metrics/cashbox?date=${effectiveDate}`), {
    cache: "no-store",
    headers,
  });

  const data: CashboxData = res.ok
    ? await res.json()
    : {
        date: effectiveDate,
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        transactionCount: 0,
        expenseCount: 0,
        incomeByMethod: [],
        expensesByCategory: [],
        transactions: [],
        expenses: [],
      };

  const isToday = effectiveDate === bogotaToday;
  const dateLabel = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(effectiveDate + "T12:00:00"));

  return (
    <div className="space-y-6">
      {/* Fecha */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-lg font-semibold capitalize">{dateLabel}</p>
          {isToday && <span className="text-xs font-medium text-primary">Hoy</span>}
        </div>
        <div className="flex gap-2 text-xs">
          <Link
            href={`/dashboard/pos?tab=caja&date=${prevDay(effectiveDate)}`}
            className="rounded-lg border border-white/[0.06] px-3 py-1.5 transition-colors hover:bg-accent"
          >
            ← Ayer
          </Link>
          {!isToday && (
            <Link
              href={`/dashboard/pos?tab=caja&date=${nextDay(effectiveDate)}`}
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 transition-colors hover:bg-accent"
            >
              Mañana →
            </Link>
          )}
        </div>
      </div>

      {/* Cards resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <NetCard
          total={data.totalIncome}
          label={`Ingresos · ${data.transactionCount} cobro${data.transactionCount !== 1 ? "s" : ""}`}
          color="border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
          icon={ArrowUpRight}
        />
        <NetCard
          total={data.totalExpenses}
          label={`Egresos · ${data.expenseCount} egreso${data.expenseCount !== 1 ? "s" : ""}`}
          color="border-rose-500/20 bg-rose-500/5 text-rose-300"
          icon={ArrowDownRight}
        />
        <div className={`flex flex-col gap-2 rounded-xl border p-5 ${data.netBalance >= 0 ? "border-primary/20 bg-primary/5 text-primary" : "border-amber-500/20 bg-amber-500/5 text-amber-300"}`}>
          <div className="flex items-center gap-2">
            <Minus className="h-4 w-4" />
            <p className="text-sm font-medium">Neto del día</p>
          </div>
          <p className="text-3xl font-bold tabular-nums tracking-tight">{formatCOP(data.netBalance)}</p>
        </div>
      </div>

      {/* Desglose por método + categoría */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Ingresos por método */}
        <div className="rounded-xl border border-white/[0.08] border-t-2 border-t-emerald-500/50 bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-semibold">Ingresos por método</p>
          </div>
          {data.incomeByMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cobros hoy.</p>
          ) : (
            <ul className="space-y-2">
              {data.incomeByMethod.map((row) => (
                <li key={row.method} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[row.method as PaymentMethod] ?? row.method}
                    <span className="ml-1.5 text-xs opacity-60">×{row.count}</span>
                  </span>
                  <span className="tabular-nums font-semibold text-emerald-300">{formatCOP(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Egresos por categoría */}
        <div className="rounded-xl border border-white/[0.08] border-t-2 border-t-rose-500/50 bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-rose-400" />
            <p className="text-sm font-semibold">Egresos por categoría</p>
          </div>
          {data.expensesByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin egresos hoy.</p>
          ) : (
            <ul className="space-y-2">
              {data.expensesByCategory.map((row) => (
                <li key={row.category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {EXPENSE_CATEGORY_LABELS[row.category as ExpenseCategory] ?? row.category}
                    <span className="ml-1.5 text-xs opacity-60">×{row.count}</span>
                  </span>
                  <span className="tabular-nums font-semibold text-rose-300">{formatCOP(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Transacciones + Egresos del día */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cobros */}
        <div className="rounded-xl border border-white/[0.08] border-t-2 border-t-teal-500/50 bg-card">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <p className="text-sm font-semibold">Cobros del día</p>
            <Link
              href="/dashboard/pos?tab=venta"
              className="text-xs font-medium text-primary/70 transition-colors hover:text-primary"
            >
              + Nueva venta
            </Link>
          </div>
          {data.transactions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sin cobros registrados.{" "}
              <Link href="/dashboard/pos?tab=venta" className="text-primary hover:underline">
                Registrar →
              </Link>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-white/[0.04]">
                {data.transactions.map((tx) => (
                  <li key={tx.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          {tx.petName && <span>{getPetEmoji(tx.petType ?? "")}</span>}
                          <span className="truncate font-medium">{tx.clientName ?? tx.petName ?? "Sin cliente"}</span>
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
                        <p className="font-semibold tabular-nums text-emerald-300">{formatCOP(tx.total)}</p>
                        <p className="text-[11px] text-muted-foreground">{formatTime(tx.paidAt)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-white/[0.06] px-5 py-3 text-sm font-semibold">
                <span className="text-muted-foreground">Total cobros</span>
                <span className="text-emerald-300 tabular-nums">{formatCOP(data.totalIncome)}</span>
              </div>
            </>
          )}
        </div>

        {/* Egresos */}
        <div className="rounded-xl border border-white/[0.08] border-t-2 border-t-rose-500/50 bg-card">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <p className="text-sm font-semibold">Egresos del día</p>
            <Link
              href="/dashboard/pos?tab=egreso"
              className="text-xs font-medium text-rose-400/70 transition-colors hover:text-rose-400"
            >
              + Egreso
            </Link>
          </div>
          {data.expenses.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Sin egresos registrados.{" "}
              <Link href="/dashboard/pos?tab=egreso" className="text-rose-400 hover:underline">
                Registrar →
              </Link>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-white/[0.04]">
                {data.expenses.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${EXPENSE_CATEGORY_COLORS[e.category as ExpenseCategory] ?? "bg-slate-500/15 text-slate-400"}`}>
                            {EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums text-rose-300">{formatCOP(e.amount)}</p>
                        <p className="text-[11px] text-muted-foreground">{formatTime(e.date)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-white/[0.06] px-5 py-3 text-sm font-semibold">
                <span className="text-muted-foreground">Total egresos</span>
                <span className="text-rose-300 tabular-nums">{formatCOP(data.totalExpenses)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function prevDay(ymd: string) {
  const d = new Date(ymd + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function nextDay(ymd: string) {
  const d = new Date(ymd + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
