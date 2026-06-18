"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proxyUrl } from "@/lib/api";
import { getPetEmoji } from "@/lib/pets";
import {
  type PaymentMethod,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ICONS,
  formatCOP,
} from "@/lib/transactions";

// ── Types ─────────────────────────────────────────────────────

type LineItem = { id: string; description: string; quantity: number; unitPrice: string };
type ClientResult = { id: string; name: string | null; phone: string; pets: { id: string; name: string; type: string }[] };

function newLine(): LineItem {
  return { id: Math.random().toString(36).slice(2), description: "", quantity: 1, unitPrice: "" };
}

// ── Client search ─────────────────────────────────────────────

function ClientSearch({ onSelect }: { onSelect: (c: ClientResult | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    // El clear de resultados ocurre dentro del timeout (no síncrono en el effect)
    // para evitar el cascading render que marca react-hooks/set-state-in-effect.
    debounce.current = setTimeout(async () => {
      if (query.length < 2) { setResults([]); return; }
      setSearching(true);
      try {
        const res = await fetch(proxyUrl(`/api/dashboard/clients?search=${encodeURIComponent(query)}&limit=8`), { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          // API returns array of clients; attach pets from nested structure
          setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch {
        // Búsqueda en vivo (debounced): un fallo puntual no necesita toast,
        // el usuario sigue escribiendo y se reintenta solo.
      } finally { setSearching(false); }
    }, query.length < 2 ? 0 : 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">Buscar cliente (nombre o teléfono)</label>
      <Input
        placeholder="ej. Ana o 3001234567"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onSelect(null); }}
      />
      {searching && <p className="text-xs text-muted-foreground">Buscando…</p>}
      {results.length > 0 && (
        <ul className="rounded-lg border bg-background shadow-md divide-y max-h-48 overflow-y-auto">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => { onSelect(c); setQuery(c.name ?? c.phone); setResults([]); }}
              >
                <span className="font-medium">{c.name ?? "Sin nombre"}</span>
                <span className="ml-2 text-muted-foreground text-xs">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main POS form ─────────────────────────────────────────────

export function PosForm() {
  const router = useRouter();
  const [client, setClient] = useState<ClientResult | null>(null);
  const [petId, setPetId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [saving, setSaving] = useState(false);
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
    if (validLines.length === 0) { setError("Agrega al menos un ítem con descripción y precio"); return; }

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
      router.push("/dashboard/revenue");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      {/* Cliente */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Cliente</p>
        <ClientSearch onSelect={(c) => { setClient(c); setPetId(""); }} />
        {client && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="font-medium">{client.name ?? "Sin nombre"}</span>
            <span className="ml-2 text-muted-foreground">{client.phone}</span>
            {client.pets?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {client.pets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPetId((prev) => prev === p.id ? "" : p.id)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors
                      ${petId === p.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"}`}
                  >
                    {getPetEmoji(p.type)} {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ítems */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Ítems del cobro</p>
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.id} className="grid grid-cols-[1fr_60px_100px_auto] gap-2 items-center">
              <Input
                placeholder={`Descripción (ej. Baño + corte)`}
                value={line.description}
                onChange={(e) => setLine(line.id, "description", e.target.value)}
              />
              <Input
                type="number"
                min="1"
                placeholder="Cant."
                value={line.quantity}
                onChange={(e) => setLine(line.id, "quantity", parseInt(e.target.value) || 1)}
                className="text-center"
              />
              <Input
                type="number"
                min="0"
                placeholder="Precio"
                value={line.unitPrice}
                onChange={(e) => setLine(line.id, "unitPrice", e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeLine(line.id)}
                disabled={lines.length === 1}
                className="text-muted-foreground hover:text-destructive disabled:opacity-30 px-1"
                aria-label="Eliminar ítem"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setLines((p) => [...p, newLine()])}>
          + Agregar ítem
        </Button>
      </div>

      {/* Método de pago */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Método de pago</p>
        <div className="flex flex-wrap gap-2">
          {(["cash","transfer","card","other"] as PaymentMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors
                ${paymentMethod === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"}`}
            >
              {PAYMENT_METHOD_ICONS[m]} {PAYMENT_METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Notas */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notas (opcional)</label>
        <Input
          placeholder="Observaciones del cobro…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Total + submit */}
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Total a cobrar</span>
        <span className="text-2xl font-bold">{formatCOP(total)}</span>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || total === 0} className="flex-1">
          {saving ? "Registrando…" : "✓ Registrar cobro"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/revenue")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
