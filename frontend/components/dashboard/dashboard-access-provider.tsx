"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { proxyUrl } from "@/lib/api";
import type { DashboardAccess } from "@/lib/dashboard-access";
import { SessionRecovery } from '@/components/auth/session-recovery';

const AccessContext = createContext<DashboardAccess | null>(null);
export const useDashboardAccess = () => useContext(AccessContext);

export function DashboardAccessProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tenant = useSearchParams().get("tenant");
  const [access, setAccess] = useState<DashboardAccess | null>(null);
  const [failed, setFailed] = useState(false);
  const requestVersion = useRef(0);
  const invalidate = useCallback(() => { ++requestVersion.current; }, []);
  const refresh = useCallback(async () => {
    // A known offline browser cannot revalidate permissions. Preserve the mounted
    // workspace; every authenticated operation still checks access on the server.
    if (!navigator.onLine) return;
    const version = ++requestVersion.current;
    try {
      const response = await fetch(proxyUrl("/api/dashboard/access" + (tenant ? "?tenantId=" + encodeURIComponent(tenant) : "")), { cache: "no-store" });
      if ((response.status === 401 || response.status === 403) && version === requestVersion.current) {
        setAccess(null); router.replace('/session-recovery?reason=session'); return;
      }
      if (!response.ok) throw new Error("Access unavailable");
      const manifest = await response.json();
      if (version === requestVersion.current) { setAccess(manifest); setFailed(false); }
    } catch { if (version === requestVersion.current && navigator.onLine) { setAccess(null); setFailed(true); } }
  }, [tenant, router]);
  useEffect(() => {
    let active = true;
    const refreshIfActive = () => { if (active) void refresh(); };
    refreshIfActive();
    const timer = setInterval(refreshIfActive, 30000);
    window.addEventListener("focus", refreshIfActive);
    window.addEventListener("online", refreshIfActive);
    window.addEventListener("mateos-business-config-updated", refreshIfActive);
    return () => { active = false; invalidate(); setAccess(null); clearInterval(timer); window.removeEventListener("focus", refreshIfActive); window.removeEventListener("online", refreshIfActive); window.removeEventListener("mateos-business-config-updated", refreshIfActive); };
  }, [refresh, invalidate]);
  if (!access) return failed ? <SessionRecovery onRetry={() => void refresh()} /> : <div className="m-8 rounded-2xl border bg-white p-6" role="status">Preparando tu espacio de trabajo…</div>;
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}
