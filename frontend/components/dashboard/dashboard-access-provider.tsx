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
  const [access, setAccess] = useState<{ tenant: string | null; value: DashboardAccess } | null>(null);
  const [failed, setFailed] = useState(false);
  const requestVersion = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const retryAt = useRef(0);
  const revoked = useRef(false);
  const invalidate = useCallback(() => { ++requestVersion.current; }, []);
  const refresh = useCallback(async () => {
    // A known offline browser cannot revalidate permissions. Preserve the mounted
    // workspace; every authenticated operation still checks access on the server.
    if (!navigator.onLine || revoked.current || inFlight.current || Date.now() < retryAt.current) return;
    const version = ++requestVersion.current;
    const controller = new AbortController();
    inFlight.current = controller;
    retryAt.current = Date.now() + 2000;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(proxyUrl("/api/dashboard/access" + (tenant ? "?tenantId=" + encodeURIComponent(tenant) : "")), { cache: "no-store", signal: controller.signal });
      if (version !== requestVersion.current) return;
      if ((response.status === 401 || response.status === 403) && version === requestVersion.current) {
        revoked.current = true;
        setAccess(null); router.replace('/session-recovery?reason=session'); return;
      }
      if (!response.ok) {
        if (response.status === 429) {
          const header = response.headers.get('Retry-After');
          const seconds = header?.trim() ? Number(header) : NaN;
          const wait = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - Date.now() : NaN;
          retryAt.current = Date.now() + (Number.isFinite(wait) ? Math.min(300000, Math.max(2000, wait)) : 30000);
        }
        // Suspension and other definitive denials must block the workspace.
        if (response.status < 500 && ![408, 429].includes(response.status)) setAccess(null);
        throw new Error("Access unavailable");
      }
      const manifest = await response.json();
      if (version === requestVersion.current) { setAccess({ tenant, value: manifest }); setFailed(false); }
    } catch { if (version === requestVersion.current) setFailed(true); }
    finally { clearTimeout(timeout); if (inFlight.current === controller) inFlight.current = null; }
  }, [tenant, router]);
  useEffect(() => {
    let active = true;
    const refreshIfActive = () => { if (active) void refresh(); };
    refreshIfActive();
    const timer = setInterval(refreshIfActive, 30000);
    window.addEventListener("focus", refreshIfActive);
    window.addEventListener("online", refreshIfActive);
    const offline = () => { if (active) setFailed(true); };
    window.addEventListener("offline", offline);
    window.addEventListener("mateos-business-config-updated", refreshIfActive);
    return () => { active = false; invalidate(); inFlight.current?.abort(); inFlight.current = null; retryAt.current = 0; revoked.current = false; setAccess(null); clearInterval(timer); window.removeEventListener("focus", refreshIfActive); window.removeEventListener("online", refreshIfActive); window.removeEventListener("offline", offline); window.removeEventListener("mateos-business-config-updated", refreshIfActive); };
  }, [refresh, invalidate]);
  const current = access?.tenant === tenant ? access.value : null;
  if (!current) return failed ? <SessionRecovery onRetry={() => void refresh()} /> : <div className="m-8 rounded-2xl border bg-white p-6" role="status">Preparando tu espacio de trabajo…</div>;
  return <AccessContext.Provider value={current}>
    {failed && <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><span>La conexión se está restableciendo. Conservamos tu trabajo y reintentaremos automáticamente.</span><button type="button" className="min-h-11 rounded-lg border border-amber-300 px-3 font-medium" onClick={() => void refresh()}>Reintentar conexión</button></div>}
    {children}
  </AccessContext.Provider>;
}
