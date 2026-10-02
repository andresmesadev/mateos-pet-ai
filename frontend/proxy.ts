import { auth } from "./auth";
import { NextResponse } from "next/server";
import { apiUrl, makeServerHeaders } from "./lib/api";
import type { DashboardAccess } from "./lib/dashboard-access";

export const proxy = auth(async (req) => {
  const path = req.nextUrl.pathname;
  if (!req.auth?.user || (!path.startsWith("/dashboard") && !path.startsWith("/print"))) return NextResponse.next();
  try {
    const response = await fetch(apiUrl("/api/dashboard/access"), {
      headers: makeServerHeaders(req.auth, req.nextUrl.searchParams.get("tenant")), cache: "no-store",
    });
    if (!response.ok) return new NextResponse("No se pudieron comprobar tus permisos. Vuelve a iniciar sesión o reintenta.", { status: response.status === 401 ? 401 : 503 });
    const access: DashboardAccess = await response.json();
    const permitted = path.startsWith("/print") ? access.capabilities.administration || access.capabilities.clinical
      : access.navigation.some(href => path === href || (href !== "/dashboard" && path.startsWith(href + "/")));
    const restrictedCashTab = path === "/dashboard/pos" && !access.capabilities.finance && ["egreso", "historial", "reportes"].includes(req.nextUrl.searchParams.get("tab") ?? "");
    if (!permitted || restrictedCashTab) {
      const home = req.nextUrl.clone(); home.pathname = "/dashboard"; home.search = "";
      return NextResponse.redirect(home);
    }
    return NextResponse.next();
  } catch { return new NextResponse("El servidor de datos no está disponible. Reintenta para acceder.", { status: 503 }); }
});

export const config = {
  matcher: ["/dashboard/:path*", "/print/:path*", "/login"],
};
