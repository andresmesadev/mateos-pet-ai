// Proxy para /api/billing/* — añade autenticación NextAuth y pasa el tenantId
import { auth } from "@/auth";
import { type NextRequest, NextResponse } from "next/server";

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
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId ?? null;
  if (!tenantId && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden: no tenant assigned" }, { status: 403 });
  }

  const body = await req.json();
  const { action = "checkout", ...rest } = body ?? {};
  const backendPath = BACKEND_ACTION_PATHS[action];
  if (!backendPath) {
    return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
  }

  const res = await fetch(`${BACKEND_URL}${backendPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": INTERNAL_API_SECRET,
    },
    body: JSON.stringify({
      ...rest,
      tenantId: tenantId ?? rest.tenantId,
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId ?? null;
  if (!tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = await fetch(`${BACKEND_URL}/api/billing/status/${tenantId}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": INTERNAL_API_SECRET,
    },
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
