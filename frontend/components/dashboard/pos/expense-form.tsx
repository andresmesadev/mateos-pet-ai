"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { formatCOP } from "@/lib/transactions";
import {
  type ExpenseCategory,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
} from "@/lib/expenses";

const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

const PAYMENT_METHODS = [
  { value: "cash",     label: "Efectivo",      icon: "💵" },
  { value: "transfer", label: "Transferencia", icon: "🏦" },
  { value: "card",     label: "Tarjeta",       icon: "💳" },
  { value: "other",    label: "Otro",          icon: "🔖" },
];

export function ExpenseForm() {
  const router = useRouter();
  const [category, setCategory] = useState<ExpenseCategory>("supplies");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  // Entregable Puente: responsible es obligatorio en el dominio (contrato 2.3).
  const [responsible, setResponsible] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) { setError("Agrega una descripción."); return; }
    if (!responsible.trim()) { setError("Indica el responsable del gasto."); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Ingresa un monto válido."); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/expenses"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description: description.trim(),
          amount: amt,
          paymentMethod,
          notes: notes.trim() || null,
          responsible: responsible.trim(),
        }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => null);
        throw new Error(p?.error ?? "Error al registrar");
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/pos?tab=caja");
        router.refresh();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-500/30">
          <Check className="h-8 w-8 text-rose-700" />
        </div>
        <p className="text-lg font-semibold">¡Egreso registrado!</p>
        <p className="text-sm text-muted-foreground">Redirigiendo a la caja del día…</p>
      </div>
    );
  }

  const amtNum = parseFloat(amount) || 0;

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Columna izquierda ─────────────────────────── */}
        <div className="space-y-5">
          {/* Categoría */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold">Categoría del gasto</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  aria-pressed={category === cat}
                  className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    category === cat
                      ? `border-black/15 ${EXPENSE_CATEGORY_COLORS[cat]}`
                      : "border-black/[0.06] text-muted-foreground hover:border-black/12 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${category === cat ? "bg-current" : "bg-muted-foreground/30"}`} />
                  {EXPENSE_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </section>

          {/* Descripción y monto */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold">Detalle del gasto</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="expense-description" className="mb-1 block text-sm font-medium">Descripción</label>
                <Input
                  id="expense-description"
                  placeholder="ej. Shampoo para mascotas, arriendo local…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="expense-responsible" className="mb-1 block text-sm font-medium">Responsable</label>
                <Input
                  id="expense-responsible"
                  placeholder="¿Quién registra este gasto?"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="expense-amount" className="mb-1 block text-sm font-medium">Monto (COP)</label>
                <Input
                  id="expense-amount"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-lg font-semibold tabular-nums"
                />
              </div>
            </div>
          </section>

          {/* Método de pago */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-semibold">Método de pago</h3>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  aria-pressed={paymentMethod === m.value}
                  className={`flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === m.value
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-700"
                      : "border-black/[0.06] text-muted-foreground hover:border-black/15 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span>{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          {/* Notas */}
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <label htmlFor="expense-notes" className="mb-3 block text-base font-semibold">Notas (opcional)</label>
            <Input
              id="expense-notes"
              placeholder="Proveedor, factura, observaciones…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>
        </div>

        {/* ── Columna derecha: resumen ──────────────────── */}
        <div>
          <div className="sticky top-24 rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold">Resumen del egreso</h3>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Categoría</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EXPENSE_CATEGORY_COLORS[category]}`}>
                  {EXPENSE_CATEGORY_LABELS[category]}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Descripción</span>
                <span className="max-w-[160px] truncate text-right font-medium">
                  {description || "—"}
                </span>
              </div>
            </div>

            <div className="my-4 border-t border-black/[0.06]" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total egreso</span>
              <span className="text-3xl font-bold tabular-nums tracking-tight text-rose-700">
                -{formatCOP(amtNum)}
              </span>
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={saving || amtNum <= 0}
              className="mt-4 w-full gap-2 border-rose-500/30 bg-rose-500/15 font-semibold text-rose-700 hover:bg-rose-500/25 hover:text-rose-800"
              variant="outline"
              size="lg"
            >
              <Check className="h-4 w-4" />
              {saving ? "Registrando…" : "Registrar egreso"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
