import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import type { DashboardAccess } from "@/lib/dashboard-access";

export const getDashboardAccess = cache(async (tenant?: string): Promise<DashboardAccess> => {
  const session = await auth();
  const response = await fetch(apiUrl("/api/dashboard/access"), { headers: makeServerHeaders(session, tenant), cache: "no-store" });
  if (!response.ok) throw new Error("No se pudieron comprobar los permisos del equipo");
  return response.json();
});
