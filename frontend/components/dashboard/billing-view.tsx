"use client";

import { useActionConfirmation } from "@/components/dashboard/action-confirmation";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type BillingStatus } from "@/app/dashboard/billing/page";
import { billingPlanRequest } from "@/lib/billing-plan-request";

// ── Plan definitions ──────────────────────────────────────────

type PlanId = "free" | "basic" | "pro" | "custom";

type Plan = {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight?: boolean;
};

const OPERATIONAL_FEATURES = [
  "Gestión operativa de un establecimiento",
  "Agenda, clientes y mascotas según módulos habilitados",
  "Equipo con roles y permisos",
  "Caja, inventario y comprobantes operativos",
  "Cupo de IA por confirmar en la oferta",
];

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Evaluación",
    price: "$0",
    period: "evaluación",
    features: [
      "Acceso de evaluación al dashboard según habilitación",
      "Gestión operativa según módulos y permisos",
      "IA y WhatsApp sujetos a habilitación",
    ],
  },
  {
    id: "basic",
    name: "Básico",
    price: "$49.000",
    period: "mes",
    highlight: true,
    features: OPERATIONAL_FEATURES,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$89.000",
    period: "mes",
    features: OPERATIONAL_FEATURES,
  },
  {
    id: "custom",
    name: "Personalizado",
    price: "A convenir",
    period: "cotización",
    features: [
      "Alcance acordado según las necesidades de tu negocio",
      "Propuesta y condiciones antes de contratar",
      "Precio definido mediante cotización",
    ],
  },
];

// ── Status helpers ────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  active:    { label: "Activo",          class: "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-700" },
  trialing:  { label: "Prueba",          class: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-700" },
  past_due:  { label: "Pago pendiente",  class: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-700" },
  canceled:  { label: "Cancelado",       class: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-700" },
  inactive:  { label: "Inactivo",        class: "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500" },
  none:      { label: "Sin suscripción", class: "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500" },
  unknown:   { label: "Por confirmar",   class: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-700" },
};

function StatusBadge({ subscriptionStatus }: { subscriptionStatus: string | null }) {
  const s = subscriptionStatus ?? "none";
  const cfg = STATUS_LABEL[s] ?? STATUS_LABEL.unknown;
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
  canReactivate,
  onUpgrade,
  loading,
}: {
  plan: Plan;
  isCurrent: boolean;
  isDowngrade: boolean;
  canReactivate: boolean;
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
          Referencia inicial
        </span>
      )}

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{plan.price}</span>
          {plan.id !== "free" && plan.id !== "custom" && (
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

      {isCurrent && !canReactivate ? (
        <Button disabled variant="outline" className="w-full">Plan actual</Button>
      ) : plan.id === "custom" ? (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-offset-2">Cómo acordar este plan</summary>
          <p className="mt-2 text-muted-foreground">Consulta con el equipo de Huella Nex para definir el alcance y recibir una propuesta. La cotización se acuerda antes de contratar este plan.</p>
        </details>
      ) : plan.id === "free" ? (
        <Button disabled variant="ghost" className="w-full text-muted-foreground">
          {isDowngrade ? "Contactar soporte para bajar de plan" : "Acceso de evaluación"}
        </Button>
      ) : (
        <Button
          className="w-full"
          variant={plan.highlight ? "default" : "outline"}
          disabled={loading}
          onClick={() => onUpgrade(plan)}
        >
          {loading ? "Redirigiendo…" : canReactivate ? "Volver a contratar" : isDowngrade ? "Cambiar a este plan" : "Actualizar"}
        </Button>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────

export function BillingView({ status }: { status: BillingStatus | null }) {
  const { confirm, confirmation } = useActionConfirmation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = (status?.plan ?? "free") as PlanId;
  const planOrder: PlanId[] = ["free", "basic", "pro"];

  // Entregable 4.4 — Facturación / Habilitación Comercial: si el tenant ya
  // tiene una suscripción activa (stripeSubscriptionId), cambiar de plan
  // pago→pago actualiza esa suscripción en Stripe en vez de crear una
  // segunda vía Checkout (defecto corregido en este entregable).
  const terminalSubscription = ["canceled", "incomplete_expired"].includes(status?.subscriptionStatus ?? "");
  const hasExistingSubscription = Boolean(status?.stripeSubscriptionId) && !terminalSubscription;

  async function handleUpgrade(plan: Plan) {
    if (plan.id !== "basic" && plan.id !== "pro") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...billingPlanRequest(plan.id, hasExistingSubscription, window.location.origin), tenantId: status?.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (hasExistingSubscription ? "Error al cambiar de plan" : "Error al iniciar el pago"));
      if (hasExistingSubscription) window.location.reload();
      else if (data.url) window.location.href = data.url;
      else throw new Error("No se pudo abrir el pago. Vuelve a intentarlo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!await confirm("¿Seguro que deseas cancelar tu suscripción? Perderás acceso a las funciones de tu plan actual.")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", tenantId: status?.id }),
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

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/billing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal", tenantId: status?.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "No se pudo abrir la gestión de pagos.");
      window.location.href = data.url;
    } catch (err) { setError(err instanceof Error ? err.message : "Error inesperado"); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {confirmation}
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
              <div className="font-semibold">{PLANS.find(plan => plan.id === status.plan)?.name ?? "Por confirmar"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Estado de suscripción</div>
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
            {status.stripeCustomerId && <Button variant="outline" disabled={loading} onClick={openPortal}>Gestionar pagos y suscripción</Button>}
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
        <h2 className="text-base font-semibold mb-4">Opciones de plan</h2>
        <p className="mb-5 text-sm text-muted-foreground">Básico y Pro comparten actualmente las funciones operativas. La diferencia propuesta de cupo de IA está pendiente de habilitación y confirmación comercial.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlan}
              canReactivate={!status?.active && !hasExistingSubscription && plan.id === currentPlan && (plan.id === "basic" || plan.id === "pro")}
              isDowngrade={plan.id !== "custom" && currentPlan !== "custom" && planOrder.indexOf(plan.id) < planOrder.indexOf(currentPlan)}
              onUpgrade={handleUpgrade}
              loading={loading}
            />
          ))}
        </div>
      </div>

      <section aria-labelledby="plan-scope" className="space-y-3 rounded-xl border bg-muted/30 p-5 text-sm text-muted-foreground">
        <h2 id="plan-scope" className="font-semibold text-foreground">Alcance de los planes</h2>
        <p>Cada suscripción corresponde a un establecimiento. Las funciones disponibles dependen de sus módulos y de los permisos de cada integrante; la historia clínica requiere el módulo Veterinaria.</p>
        <p>Los comprobantes son registros operativos. La facturación electrónica no forma parte de estos comprobantes.</p>
        <p>WhatsApp es opcional: cada negocio conecta su cuenta y número propios, paga sus cargos directamente a Meta y requiere la habilitación de la conexión.</p>
        <p>La IA requiere habilitación y un cupo asignado. Un cambio de plan no asigna automáticamente un cupo de IA.</p>
        {status?.active && <a className="inline-block font-medium text-primary underline underline-offset-4" href={`/dashboard/settings/integrations?tenant=${encodeURIComponent(status.id)}`}>Consultar conexión y cupo asignado</a>}
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Precios de referencia en COP, pendientes de confirmación comercial. El plan Personalizado se cotiza según el alcance acordado. Los pagos de los planes habilitados se procesan por Stripe.
        {" Revisa el importe y las condiciones mostradas por Stripe antes de confirmar el pago."}
        {hasExistingSubscription && status?.subscriptionStatus !== "canceled"
          ? " Puedes cancelar tu suscripción en cualquier momento desde el botón de arriba."
          : ""}
      </p>
    </div>
  );
}
