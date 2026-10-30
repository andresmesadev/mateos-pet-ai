// Proxy para /api/billing/* — añade autenticación NextAuth y pasa el tenantId
import { auth } from "@/auth";
import { type NextRequest, NextResponse } from "next/server";
import { verifyBillingAdministrator, billingTenantId } from "@/lib/billing-access";

const BACKEND_URL = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "";

// Entregable 4.4 (Fase 4) — Facturación / Habilitación Comercial: además de
// checkout (alta inicial), soporta cancel y change-plan (cambio entre planes
// pagos, evitando duplicar suscripciones en Stripe). El tenantId siempre se
// deriva de la sesión, nunca del cliente — mismo criterio ya aplicado a
// checkout antes de este entregable.
const BACKEND_ACTION_PATHS: Record<string, string> = {
  checkout: "/api/billing/checkout",
  cancel: "/api/billing/cancel",
  "change-plan": "/api/billing/change-plan",
  portal: "/api/billing/portal",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authorization = await verifyBillingAdministrator(session);
  if (!authorization.allowed) {
    return NextResponse.json({ error: authorization.reason === "unavailable" ? "No se pudo comprobar el acceso. Reintenta." : "Esta acción requiere acceso administrativo" }, { status: authorization.status });
  }

  const tenantId = session.user.tenantId ?? null;
  if (!tenantId && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden: no tenant assigned" }, { status: 403 });
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Solicitud de suscripción no válida" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitud de suscripción no válida" }, { status: 400 });
  }
  const { action = "checkout", ...rest } = body ?? {};
  if (typeof action !== "string" || !Object.hasOwn(BACKEND_ACTION_PATHS, action)) {
    return NextResponse.json({ error: "Acción de suscripción desconocida" }, { status: 400 });
  }
  const backendPath = BACKEND_ACTION_PATHS[action];
  const resolvedTenant = billingTenantId(session, rest.tenantId);
  if (!resolvedTenant) return NextResponse.json({ error: "Selecciona un establecimiento para gestionar su suscripción" }, { status: 403 });
  let redirectUrls = {};
  if (action === "portal" || action === "checkout") {
    const target = new URL("/dashboard/billing", process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin);
    if (session.user.isSuperAdmin) target.searchParams.set("tenant", resolvedTenant);
    if (action === "portal") redirectUrls = { returnUrl: target.href };
    else {
      const success = new URL(target); success.searchParams.set("success", "1");
      const canceled = new URL(target); canceled.searchParams.set("canceled", "1");
      redirectUrls = { successUrl: success.href, cancelUrl: canceled.href };
    }
  }

  const res = await fetch(`${BACKEND_URL}${backendPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": INTERNAL_API_SECRET,
    },
    body: JSON.stringify({
      ...rest,
      tenantId: resolvedTenant,
      ...redirectUrls,
    }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "No se pudo consultar el proveedor de facturación. Reintenta." }, { status: 503 });

  const data = await res.json().catch(() => null);
  if (!data) return NextResponse.json({ error: "Respuesta de facturación no disponible. Reintenta." }, { status: 503 });
  return NextResponse.json(data, { status: res.status });
}

export async function GET(req?: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authorization = await verifyBillingAdministrator(session);
  if (!authorization.allowed) {
    return NextResponse.json({ error: authorization.reason === "unavailable" ? "No se pudo comprobar el acceso. Reintenta." : "Esta acción requiere acceso administrativo" }, { status: authorization.status });
  }

  const tenantId = billingTenantId(session, req?.nextUrl.searchParams.get("tenant"));
  if (!tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = await fetch(`${BACKEND_URL}/api/billing/status/${tenantId}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": INTERNAL_API_SECRET,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "No se pudo consultar la suscripción. Reintenta." }, { status: 503 });

  const data = await res.json().catch(() => null);
  if (!data) return NextResponse.json({ error: "Respuesta de facturación no disponible. Reintenta." }, { status: 503 });
  return NextResponse.json(data, { status: res.status });
}
