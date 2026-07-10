"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type BillingStatus } from "@/app/dashboard/billing/page";

// ── Plan definitions ──────────────────────────────────────────

type PlanId = "free" | "basic" | "pro";

type Plan = {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  features: string[];
  priceEnvKey: string;
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Gratuito",
    price: "$0",
    period: "siempre",
    priceEnvKey: "",
    features: [
      "Agente WhatsApp NLP",
      "Hasta 50 citas/mes",
      "1 usuario staff",
      "Historial clínico básico",
    ],
  },
  {
    id: "basic",
    name: "Básico",
    price: "$49.000",
    period: "mes",
    priceEnvKey: "NEXT_PUBLIC_STRIPE_PRICE_BASIC",
    highlight: true,
    features: [
      "Todo lo del plan gratuito",
      "Citas ilimitadas",
      "Hasta 5 usuarios staff",
      "POS y facturación",
      "Campañas WhatsApp",
      "Predicción de churn",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$89.000",
    period: "mes",
    priceEnvKey: "NEXT_PUBLIC_STRIPE_PRICE_PRO",
    features: [
      "Todo lo del plan básico",
      "Staff ilimitado",
      "Múltiples sedes",
      "Soporte prioritario",
      "API de integración",
    ],
  },
];

// ── Status helpers ────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  active:    { label: "Activo",          class: "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400" },
  trialing:  { label: "Prueba",          class: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400" },
  past_due:  { label: "Pago pendiente",  class: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400" },
  canceled:  { label: "Cancelado",       class: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400" },
  inactive:  { label: "Inactivo",        class: "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400" },
};

function StatusBadge({ subscriptionStatus }: { subscriptionStatus: string | null }) {
  const s = subscriptionStatus ?? "inactive";
  const cfg = STATUS_LABEL[s] ?? STATUS_LABEL.inactive;
  return <Badge variant="outline" className={cfg.class}>{cfg.label}</Badge>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(iso));
}

// ── Plan card ─────────────────────────────────────────────────

function PlanCard({
  plan,
  isCurrent,
  isDowngrade,
  onUpgrade,
  loading,
}: {
  plan: Plan;
  isCurrent: boolean;
  isDowngrade: boolean;
  onUpgrade: (plan: Plan) => void;
  loading: boolean;
}) {
  return (
    <div className={`relative flex flex-col rounded-xl border p-5 gap-4
      ${plan.highlight ? "border-2 border-primary shadow-sm" : ""}
      ${isCurrent ? "bg-muted/40" : "bg-background"}`}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          Más popular
        </span>
      )}

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{plan.price}</span>
          {plan.period !== "siempre" && (
            <span className="text-sm text-muted-foreground">/ {plan.period}</span>
          )}
        </div>
        <div className="mt-0.5 font-semibold">{plan.name}</div>
      </div>

      <ul className="space-y-1.5 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className="w-4 h-4 shrink-0 mt-0.5 text-green-500">
              <path fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143z"
                clipRule="evenodd" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <Button disabled variant="outline" className="w-full">Plan actual</Button>
      ) : plan.id === "free" ? (
        <Button disabled variant="ghost" className="w-full text-muted-foreground">
          {isDowngrade ? "Contactar soporte para bajar de plan" : "Gratis"}
        </Button>
      ) : (
        <Button
          className="w-full"
          variant={plan.highlight ? "default" : "outline"}
          disabled={loading}
          onClick={() => onUpgrade(plan)}
        >
          {loading ? "Redirigiendo…" : isDowngrade ? "Cambiar a este plan" : "Actualizar"}
        </Button>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────

export function BillingView({ status }: { status: BillingStatus | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = (status?.plan ?? "free") as PlanId;
  const planOrder: PlanId[] = ["free", "basic", "pro"];

  // Entregable 4.4 — Facturación / Habilitación Comercial: si el tenant ya
  // tiene una suscripción activa (stripeSubscriptionId), cambiar de plan
  // pago→pago actualiza esa suscripción en Stripe en vez de crear una
  // segunda vía Checkout (defecto corregido en este entregable).
  const hasExistingSubscription = Boolean(status?.stripeSubscriptionId);

  async function handleUpgrade(plan: Plan) {
    if (!plan.priceEnvKey) return;
    setLoading(true);
    setError(null);
    const priceId = process.env[`NEXT_PUBLIC_STRIPE_PRICE_${plan.id.toUpperCase()}`] ?? plan.priceEnvKey;
    try {
      if (hasExistingSubscription) {
        const res = await fetch("/api/proxy/billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "change-plan", priceId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al cambiar de plan");
        window.location.reload();
        return;
      }

      const successUrl = `${window.location.origin}/dashboard/billing?success=1`;
      const cancelUrl  = `${window.location.origin}/dashboard/billing?canceled=1`;

      const res = await fetch("/api/proxy/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", priceId, successUrl, cancelUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al iniciar el pago");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("¿Seguro que deseas cancelar tu suscripción? Perderás acceso a las funciones de tu plan actual.")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al cancelar la suscripción");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Estado actual */}
      {status && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Suscripción actual
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Plan</div>
              <div className="font-semibold capitalize">{status.plan}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Estado</div>
              <StatusBadge subscriptionStatus={status.subscriptionStatus} />
            </div>
            {status.planExpiresAt && (
              <div>
                <div className="text-sm text-muted-foreground">
                  {status.subscriptionStatus === "canceled" ? "Acceso hasta" : "Próximo cobro"}
                </div>
                <div className="font-semibold">{fmtDate(status.planExpiresAt)}</div>
              </div>
            )}
            {hasExistingSubscription && status.subscriptionStatus !== "canceled" && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                disabled={loading}
                onClick={handleCancel}
              >
                Cancelar suscripción
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Planes */}
      <div>
        <h2 className="text-base font-semibold mb-4">Planes disponibles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlan}
              isDowngrade={planOrder.indexOf(plan.id) < planOrder.indexOf(currentPlan)}
              onUpgrade={handleUpgrade}
              loading={loading}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Los pagos son procesados de forma segura por Stripe.
        {hasExistingSubscription && status?.subscriptionStatus !== "canceled"
          ? " Puedes cancelar tu suscripción en cualquier momento desde el botón de arriba."
          : ""}
        {" "}Los precios incluyen IVA.
      </p>
    </div>
  );
}
