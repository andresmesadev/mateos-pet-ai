import { auth } from "@/auth";
import { type NextRequest, NextResponse } from "next/server";

const BACKEND_URL = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "";

if (!INTERNAL_API_SECRET) {
  console.error(
    "[Proxy] ⚠️  INTERNAL_API_SECRET is not set in environment. " +
    "All backend requests will be rejected with 401. " +
    "Add INTERNAL_API_SECRET=<value> to frontend/.env.local and restart Next.js."
  );
}

async function handler(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!INTERNAL_API_SECRET) {
    return NextResponse.json(
      { error: "Server misconfiguration: INTERNAL_API_SECRET not set" },
      { status: 503 }
    );
  }

  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  const isSuperAdmin = session.user.isSuperAdmin ?? false;

  // Single-tenant mode: backend resolves tenant from SINGLE_TENANT_ID env.
  // We still forward the session tenantId when available as a hint.
  // Solo un superadmin puede seleccionar otro tenant vía query param;
  // un usuario normal siempre opera con el tenant de su sesión (hallazgo A3,
  // auditoría v2.1.0 — mismo criterio que makeServerHeaders en lib/api.ts).
  const tenantId: string | null = isSuperAdmin
    ? (req.nextUrl.searchParams.get("tenantId") ?? session.user.tenantId ?? null)
    : (session.user.tenantId ?? null);

  // Build backend URL, forwarding non-tenantId query params
  const backendUrl = new URL(
    `${BACKEND_URL}/api/dashboard/${path.join("/")}`
  );
  req.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "tenantId") backendUrl.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Internal-Token": INTERNAL_API_SECRET,
    "X-Super-Admin": String(isSuperAdmin),
  };
  if (tenantId) headers["X-Tenant-Id"] = tenantId;

  const body =
    req.method !== "GET" && req.method !== "DELETE"
      ? await req.text()
      : undefined;

  const response = await fetch(backendUrl.toString(), {
    method: req.method,
    headers,
    body,
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ?? "application/json",
    },
  });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
