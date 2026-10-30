// Server-only adapter: never import this module from client components.
import type { Session } from "next-auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";

type BillingAuthorization = { allowed: true } | { allowed: false; status: number; reason: "session" | "role" | "unavailable" };

export async function verifyBillingAdministrator(session: Session | null): Promise<BillingAuthorization> {
  if (!session?.user) return { allowed: false, status: 401, reason: "session" };
  if (!session.user.staffId) {
    return session.user.isSuperAdmin && session.user.role === "admin"
      ? { allowed: true } : { allowed: false, status: 403, reason: "role" };
  }
  if (!session.user.tenantId || !Number.isSafeInteger(session.user.sessionVersion) || Number(session.user.sessionVersion) < 1) {
    return { allowed: false, status: 403, reason: "session" };
  }
  try {
    const response = await fetch(apiUrl("/api/internal/staff-session"), {
      headers: makeServerHeaders(session), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { allowed: false, status: response.status === 401 || response.status === 403 ? response.status : 503,
      reason: response.status === 401 || response.status === 403 ? "session" : "unavailable" };
    const current = await response.json() as { role?: string };
    return current.role === "admin" ? { allowed: true } : { allowed: false, status: 403, reason: "role" };
  } catch { return { allowed: false, status: 503, reason: "unavailable" }; }
}

export function billingTenantId(session: Session | null, selected?: unknown): string | null {
  const candidate = session?.user?.isSuperAdmin ? (selected ?? session.user.tenantId) : session?.user?.tenantId;
  return typeof candidate === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(candidate) ? candidate : null;
}
