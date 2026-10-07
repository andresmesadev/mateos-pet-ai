"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { proxyUrl } from "@/lib/api";
import type { DashboardAccess } from "@/lib/dashboard-access";

const AccessContext = createContext<DashboardAccess | null>(null);
export const useDashboardAccess = () => useContext(AccessContext);

export function DashboardAccessProvider({ children }: { children: React.ReactNode }) {
  const tenant = useSearchParams().get("tenant");
  const [access, setAccess] = useState<DashboardAccess | null>(null);
  const [failed, setFailed] = useState(false);
  const requestVersion = useRef(0);
  const invalidate = useCallback(() => { ++requestVersion.current; }, []);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const response = await fetch(proxyUrl("/api/dashboard/access" + (tenant ? "?tenantId=" + encodeURIComponent(tenant) : "")), { cache: "no-store" });
      if (!response.ok) throw new Error("Access unavailable");
      const manifest = await response.json();
      if (version === requestVersion.current) { setAccess(manifest); setFailed(false); }
    } catch { if (version === requestVersion.current) { setAccess(null); setFailed(true); } }
  }, [tenant]);
  useEffect(() => {
    let active = true;
    const refreshIfActive = () => { if (active) void refresh(); };
    refreshIfActive();
    const timer = setInterval(refreshIfActive, 30000);
    window.addEventListener("focus", refreshIfActive);
    window.addEventListener("mateos-business-config-updated", refreshIfActive);
    return () => { active = false; invalidate(); setAccess(null); clearInterval(timer); window.removeEventListener("focus", refreshIfActive); window.removeEventListener("mateos-business-config-updated", refreshIfActive); };
  }, [refresh, invalidate]);
  if (!access) return <div className="m-8 rounded-2xl border bg-white p-6" role="status">{failed ? <><p>No se pudieron comprobar tus permisos.</p><button className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-white" onClick={() => void refresh()}>Reintentar</button></> : "Preparando tu espacio de trabajo…"}</div>;
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}
