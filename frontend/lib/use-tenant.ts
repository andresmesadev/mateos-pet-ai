"use client";

import { useSearchParams } from "next/navigation";

export function useTenant(): string | null {
  const params = useSearchParams();
  return params.get("tenant") ?? null;
}

export function tenantQuery(tenantId: string | null): string {
  return tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
}
