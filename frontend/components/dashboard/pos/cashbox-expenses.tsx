"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXPENSE_CATEGORY_COLORS, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/expenses";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/transactions";
import { formatPosMoney } from "@/lib/pos-checkout";
import { VoidExpenseDialog } from "./void-expense-dialog";

export type CashboxExpense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  date: string;
  responsible: string | null;
};

export function CashboxExpenses({ expenses, expenseHref }: { expenses: CashboxExpense[]; expenseHref: string }) {
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState("all");
  const [selected, setSelected] = useState<CashboxExpense | null>(null);
  const categories = [...new Set(expenses.map(row => row.category))];
  const methods = [...new Set(expenses.map(row => row.paymentMethod))];
  const rows = expenses.filter(row => (category === "all" || row.category === category) && (method === "all" || row.paymentMethod === method));
  const total = rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;
  const filtered = category !== "all" || method !== "all";

  return <section aria-label="Gastos del día" className="overflow-hidden rounded-xl border bg-white">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
      <h4 className="flex items-center gap-2 font-semibold"><ArrowDownRight className="h-4 w-4 text-rose-700" />Gastos del día</h4>
      {expenses.length > 0 && <Button asChild variant="outline"><Link href={expenseHref}><Plus className="mr-2 h-4 w-4" />Registrar gasto</Link></Button>}
    </header>
    {!expenses.length ? <div className="px-5 py-8 text-center">
      <p className="font-semibold">No hay gastos registrados</p>
      <p className="mt-1 text-sm text-muted-foreground">Los gastos de la fecha seleccionada aparecerán aquí.</p>
      <Button asChild className="mt-4"><Link href={expenseHref}><Plus className="mr-2 h-4 w-4" />Registrar gasto</Link></Button>
    </div> : <>
      <div className="grid gap-3 border-b bg-muted/20 p-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Categoría del gasto<select value={category} onChange={event => setCategory(event.target.value)} className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm"><option value="all">Todas las categorías</option>{categories.map(value => <option key={value} value={value}>{EXPENSE_CATEGORY_LABELS[value as ExpenseCategory] ?? value}</option>)}</select></label>
        <label className="text-sm font-medium">Medio de pago del gasto<select value={method} onChange={event => setMethod(event.target.value)} className="mt-2 block h-11 w-full rounded-lg border bg-white px-3 text-sm"><option value="all">Todos los medios</option>{methods.map(value => <option key={value} value={value}>{PAYMENT_METHOD_LABELS[value as PaymentMethod] ?? value}</option>)}</select></label>
        <p role="status" className="self-center text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? "gasto" : "gastos"} · {formatPosMoney(total)}{filtered ? " en este filtro" : " en esta fecha"}</p>
        {filtered && <Button type="button" variant="outline" className="justify-self-start sm:justify-self-end" onClick={() => { setCategory("all"); setMethod("all"); }}>Limpiar filtros</Button>}
      </div>
      {rows.length ? <ul className="divide-y">{rows.map(row => <li key={row.id} className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{row.description}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs ${EXPENSE_CATEGORY_COLORS[row.category as ExpenseCategory] ?? "bg-muted text-muted-foreground"}`}>{EXPENSE_CATEGORY_LABELS[row.category as ExpenseCategory] ?? row.category}</span><span className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[row.paymentMethod as PaymentMethod] ?? row.paymentMethod} · {new Date(row.date).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" })}</span></div></div>
          <strong className="text-sm tabular-nums text-rose-700">{formatPosMoney(row.amount)}</strong>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 break-words text-xs text-muted-foreground">Responsable: {row.responsible || "No registrado"}</p><Button type="button" variant="destructive" size="sm" onClick={() => setSelected(row)} aria-label={`Anular gasto: ${row.description}`}>Anular</Button></div>
        {row.notes && <details className="mt-3 rounded-lg bg-muted/30 px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-primary">Ver nota</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{row.notes}</p></details>}
      </li>)}</ul> : <div className="px-5 py-8 text-center"><p className="font-semibold">No hay gastos con estos filtros</p><p className="mt-1 text-sm text-muted-foreground">Cambia la categoría o el medio de pago para revisar otros gastos.</p></div>}
    </>}
    {selected && <VoidExpenseDialog key={selected.id} expense={selected} onClose={() => setSelected(null)} />}
  </section>;
}
