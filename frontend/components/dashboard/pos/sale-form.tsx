"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Check, User, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { getPetEmoji } from "@/lib/pets";
import {
  type PaymentMethod,
  PAYMENT_METHOD_LABELS,
  formatCOP,
} from "@/lib/transactions";

// ── Types ─────────────────────────────────────────────────────

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
};

type ClientResult = {
  id: string;
  name: string | null;
  phone: string;
  pets: { id: string; name: string; type: string }[];
};

function newLine(): LineItem {
  return { id: Math.random().toString(36).slice(2), description: "", quantity: 1, unitPrice: "" };
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: "cash",     label: "Efectivo",       icon: "💵" },
  { value: "transfer", label: "Transferencia",  icon: "🏦" },
  { value: "card",     label: "Tarjeta",        icon: "💳" },
  { value: "other",    label: "Otro",           icon: "🔖" },
];

// ── Client search ─────────────────────────────────────────────

function ClientSearch({ onSelect }: { onSelect: (c: ClientResult | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      if (query.length < 2) { setResults([]); return; }
      setSearching(true);
      try {
        const res = await fetch(proxyUrl(`/api/dashboard/clients?search=${encodeURIComponent(query)}&limit=8`), { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch { /* silent */ }
      finally { setSearching(false); }
    }, query.length < 2 ? 0 : 280);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  return (
    <div className="relative space-y-1">
      <div className="relative">
        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente por nombre o teléfono…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onSelect(null); }}
          className="pl-9"
        />
      </div>
      {searching && (
        <p className="text-xs text-muted-foreground px-1">Buscando…</p>
      )}
      {results.length > 0 && (
        <div className="absolute z-20 w-full rounded-xl border border-white/[0.08] bg-popover shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent"
              onClick={() => { onSelect(c); setQuery(c.name ?? c.phone); setResults([]); }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-400">
                {(c.name?.trim()?.[0] ?? "#").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name ?? "Sin nombre"}</p>
                <p className="text-xs text-muted-foreground">{c.phone}</p>
              </div>
              {c.pets?.length > 0 && (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {c.pets.length} mascota{c.pets.length !== 1 ? "s" : ""}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sale Form ─────────────────────────────────────────────────

export function SaleForm() {
  const router = useRouter();
  const [client, setClient] = useState<ClientResult | null>(null);
  const [petId, setPetId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce((s, l) => {
    const price = parseFloat(l.unitPrice) || 0;
    return s + price * l.quantity;
  }, 0);

  function setLine(id: string, field: keyof LineItem, value: string | number) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  function removeLine(id: string) {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validLines = lines.filter((l) => l.description.trim() && parseFloat(l.unitPrice) > 0);
    if (validLines.length === 0) {
      setError("Agrega al menos un ítem con descripción y precio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        userId: client?.id ?? null,
        petId: petId || null,
        paymentMethod,
        notes: notes.trim() || null,
        items: validLines.map((l) => ({
          description: l.description.trim(),
          quantity: l.quantity,
          unitPrice: parseFloat(l.unitPrice),
        })),
      };
      const res = await fetch(proxyUrl("/api/dashboard/transactions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <p className="text-lg font-semibold">¡Cobro registrado!</p>
        <p className="text-sm text-muted-foreground">Redirigiendo a la caja del día…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Columna izquierda ─────────────────────────── */}
        <div className="space-y-5">
          {/* Cliente */}
          <section className="rounded-xl border border-white/[0.08] border-t-2 border-t-violet-500/50 bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-400/80">Cliente</p>
            <ClientSearch onSelect={(c) => { setClient(c); setPetId(""); }} />
            {client && (
              <div className="mt-3 rounded-lg border border-white/[0.06] bg-accent/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-400">
                    {(client.name?.trim()?.[0] ?? "#").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{client.name ?? "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">{client.phone}</p>
                  </div>
                </div>
                {client.pets?.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Seleccionar mascota</p>
                    <div className="flex flex-wrap gap-1.5">
                      {client.pets.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPetId((prev) => prev === p.id ? "" : p.id)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 ${
                            petId === p.id
                              ? "border-primary/50 bg-primary/15 text-primary"
                              : "border-white/[0.08] bg-background/50 hover:border-white/20 hover:bg-accent"
                          }`}
                        >
                          {getPetEmoji(p.type)} {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Ítems */}
          <section className="rounded-xl border border-white/[0.08] border-t-2 border-t-teal-500/50 bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-teal-400/80">Ítems del cobro</p>
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[1fr_56px_120px_32px] gap-2 px-1">
                <p className="text-[11px] font-medium text-muted-foreground">Descripción</p>
                <p className="text-[11px] font-medium text-muted-foreground text-center">Cant.</p>
                <p className="text-[11px] font-medium text-muted-foreground">Precio unit.</p>
                <span />
              </div>

              {lines.map((line, idx) => (
                <div key={line.id} className="grid grid-cols-[1fr_56px_120px_32px] gap-2 items-center">
                  <div className="relative">
                    <Tag className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      placeholder={idx === 0 ? "ej. Baño + corte" : "Descripción"}
                      value={line.description}
                      onChange={(e) => setLine(line.id, "description", e.target.value)}
                      className="pl-8 text-sm"
                    />
                  </div>
                  <Input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => setLine(line.id, "quantity", parseInt(e.target.value) || 1)}
                    className="text-center text-sm"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="0"
                    value={line.unitPrice}
                    onChange={(e) => setLine(line.id, "unitPrice", e.target.value)}
                    className="text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-20"
                    aria-label="Eliminar ítem"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLines((p) => [...p, newLine()])}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-white/[0.1] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar ítem
            </button>
          </section>

          {/* Método de pago */}
          <section className="rounded-xl border border-white/[0.08] border-t-2 border-t-amber-500/50 bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-400/80">Método de pago</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                    paymentMethod === m.value
                      ? "border-primary/40 bg-primary/15 text-primary shadow-[0_0_0_1px_oklch(0.74_0.13_195/0.3)]"
                      : "border-white/[0.06] bg-background/50 text-muted-foreground hover:border-white/15 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <span>{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          {/* Notas */}
          <section className="rounded-xl border border-white/[0.08] bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notas (opcional)</p>
            <Input
              placeholder="Observaciones del cobro…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>
        </div>

        {/* ── Columna derecha: resumen ──────────────────── */}
        <div className="space-y-4">
          <div className="sticky top-24 rounded-xl border border-white/[0.08] border-t-2 border-t-emerald-500/50 bg-card p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-emerald-400/80">Resumen del cobro</p>

            {/* Líneas */}
            <div className="space-y-2">
              {lines.filter((l) => l.description || l.unitPrice).map((l) => {
                const p = parseFloat(l.unitPrice) || 0;
                const sub = p * l.quantity;
                if (!l.description && !p) return null;
                return (
                  <div key={l.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {l.description || "—"}{l.quantity > 1 && <span className="ml-1 text-xs">×{l.quantity}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums font-medium">{formatCOP(sub)}</span>
                  </div>
                );
              })}
              {lines.every((l) => !l.description && !l.unitPrice) && (
                <p className="text-sm text-muted-foreground/50">Sin ítems aún…</p>
              )}
            </div>

            {/* Divider + total */}
            <div className="my-4 border-t border-white/[0.06]" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-3xl font-bold tabular-nums tracking-tight text-primary">
                {formatCOP(total)}
              </span>
            </div>

            {/* Cliente seleccionado */}
            {client && (
              <div className="mt-3 rounded-lg bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
                {client.name ?? client.phone}
                {petId && client.pets.find((p) => p.id === petId) && (
                  <span className="ml-1">
                    · {getPetEmoji(client.pets.find((p) => p.id === petId)!.type)}{" "}
                    {client.pets.find((p) => p.id === petId)!.name}
                  </span>
                )}
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={saving || total === 0}
              className="mt-4 w-full gap-2 font-semibold"
              size="lg"
            >
              <Check className="h-4 w-4" />
              {saving ? "Registrando…" : "Registrar cobro"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
