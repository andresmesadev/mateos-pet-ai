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

  // Resolve tenantId: normal user → always from session (ignore query param)
  // Super admin → from query param (can be null for "all")
  let tenantId: string | null = null;
  if (isSuperAdmin) {
    tenantId = req.nextUrl.searchParams.get("tenantId");
  } else {
    tenantId = session.user.tenantId ?? null;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Forbidden: no tenant assigned" },
        { status: 403 }
      );
    }
  }

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
