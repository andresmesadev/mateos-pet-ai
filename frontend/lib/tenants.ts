export type Tenant = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string | null;
  plan: string;
  active: boolean;
  createdAt: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  planExpiresAt: string | null;
  _count: {
    users: number;
    pets: number;
    appointments: number;
    conversations?: number;
  };
};

export const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
};

export const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "basic", label: "Basic" },
  { value: "pro", label: "Pro" },
];

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  trialing: "Prueba",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
};

export function formatTenantCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatPlanExpiresAt(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
