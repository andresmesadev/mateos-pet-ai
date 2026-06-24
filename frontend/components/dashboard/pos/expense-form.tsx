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
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) { setError("Agrega una descripción."); return; }
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
          <Check className="h-8 w-8 text-rose-400" />
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
          <section className="rounded-xl border border-white/[0.06] bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Categoría</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    category === cat
                      ? `border-white/15 ${EXPENSE_CATEGORY_COLORS[cat]}`
                      : "border-white/[0.06] text-muted-foreground hover:border-white/12 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${category === cat ? "bg-current" : "bg-muted-foreground/30"}`} />
                  {EXPENSE_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </section>

          {/* Descripción y monto */}
          <section className="rounded-xl border border-white/[0.06] bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Detalle</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Descripción</label>
                <Input
                  placeholder="ej. Shampoo para mascotas, arriendo local…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Monto (COP)</label>
                <Input
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
          <section className="rounded-xl border border-white/[0.06] bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">¿Cómo se pagó?</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                    paymentMethod === m.value
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      : "border-white/[0.06] text-muted-foreground hover:border-white/15 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span>{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          {/* Notas */}
          <section className="rounded-xl border border-white/[0.06] bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notas (opcional)</p>
            <Input
              placeholder="Proveedor, factura, observaciones…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>
        </div>

        {/* ── Columna derecha: resumen ──────────────────── */}
        <div>
          <div className="sticky top-24 rounded-xl border border-white/[0.06] bg-card p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Resumen del egreso</p>

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

            <div className="my-4 border-t border-white/[0.06]" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total egreso</span>
              <span className="text-3xl font-bold tabular-nums tracking-tight text-rose-400">
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
              className="mt-4 w-full gap-2 border-rose-500/30 bg-rose-500/15 font-semibold text-rose-300 hover:bg-rose-500/25 hover:text-rose-200"
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
