"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDashboardAccess } from "./dashboard-access-provider";
import { Calendar, MessageCircle } from "lucide-react";
import { useTenant } from "@/lib/use-tenant";
import { homeHref } from "@/lib/home-workspace";
import { DashboardSearch } from "./dashboard-search";

function todayLabel(): string {
  const s = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DashboardTopbar() {
  const { data: session } = useSession();
  const access = useDashboardAccess();
  const pathname = usePathname();
  const tenant = useTenant();
  const isHome = pathname === "/dashboard";
  const isVet = access?.role === "vet";

  const rawName = session?.user?.name ?? "";
  const firstName = rawName.split(" ")[0] || "de nuevo";

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-border bg-white/95 px-4 py-4 backdrop-blur-md md:flex-row md:items-center md:justify-between md:px-8">
      <div className="pl-12 lg:pl-0">
        {isVet && pathname === "/dashboard/consultas" ? (
          <><h1 className="text-xl font-bold tracking-tight">Consultas veterinarias</h1><p className="text-sm text-muted-foreground">Tu espacio clínico de trabajo</p></>
        ) : isHome ? (
          <>
            <h1 className="text-xl font-bold tracking-tight md:text-[1.65rem]">
              Hola, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {access?.capabilities.administration ? "Este es el estado de tu negocio hoy." : "Estas son las tareas de tu jornada."}
            </p>
          </>
        ) : (
          <p className="text-sm font-semibold text-foreground/70">
            Panel operativo
          </p>
        )}
      </div>

      {/* Acciones */}
      {access?.capabilities.contacts && <div className="flex items-center gap-2 md:gap-3">
        <DashboardSearch key={`${session?.user?.email}:${session?.user?.sessionVersion}:${tenant ?? "current"}`} tenant={tenant} />

        <Link
          prefetch={false}
          href={homeHref("/dashboard/conversations", tenant)}
          title="Conversaciones de WhatsApp"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 text-teal-700 transition-colors hover:bg-teal-100"
        >
          <MessageCircle className="h-5 w-5" />
        </Link>

        <Link
          prefetch={false}
          href={homeHref(access?.capabilities.agenda ? "/dashboard/calendar" : "/dashboard", tenant)}
          title="Agenda"
          className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden font-medium md:inline">{todayLabel()}</span>
        </Link>
      </div>}
    </header>
  );
}
