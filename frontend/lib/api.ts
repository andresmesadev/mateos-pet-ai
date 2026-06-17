const DEFAULT_API_URL = "http://localhost:3000";

function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return (
      process.env.API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      DEFAULT_API_URL
    ).replace(/\/$/, "");
  }

  return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
}

export const API_URL = resolveApiBaseUrl();

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveApiBaseUrl()}${normalizedPath}`;
}

/**
 * For client components: routes through Next.js proxy (adds auth headers server-side).
 * dashboardPath is like "/api/dashboard/clients"
 */
export function proxyUrl(dashboardPath: string): string {
  const proxyPath = dashboardPath.replace("/api/dashboard", "/api/proxy/dashboard");
  if (typeof window !== "undefined") return proxyPath;
  const base =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3001";
  return `${base.replace(/\/$/, "")}${proxyPath}`;
}

/**
 * For server components: direct to backend with internal auth headers.
 */
export function makeServerHeaders(
  session: { user: { tenantId: string | null; isSuperAdmin: boolean } } | null,
  selectedTenant?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Internal-Token": process.env.INTERNAL_API_SECRET ?? "",
    "X-Super-Admin": String(session?.user?.isSuperAdmin ?? false),
  };
  const tenantId = session?.user?.isSuperAdmin
    ? (selectedTenant ?? session?.user?.tenantId ?? null)
    : (session?.user?.tenantId ?? null);
  if (tenantId) headers["X-Tenant-Id"] = tenantId;
  return headers;
}
