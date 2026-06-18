"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bell, Calendar, MessageCircle, Search } from "lucide-react";

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
  const rawName = session?.user?.name ?? "";
  const firstName = rawName.split(" ")[0] || "de nuevo";

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-border bg-background/80 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
      {/* Saludo */}
      <div className="pl-12 lg:pl-0">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          ¡Hola, {firstName}! 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Aquí tienes el resumen de tu operación de hoy.
        </p>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Buscador */}
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar clientes, mascotas, citas…"
            className="h-10 w-56 rounded-xl border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring md:w-72"
          />
        </div>

        <Link
          href="/dashboard/conversations"
          title="Conversaciones de WhatsApp"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-input bg-card text-emerald-500 transition-colors hover:bg-accent"
        >
          <MessageCircle className="h-5 w-5" />
        </Link>

        <button
          type="button"
          title="Notificaciones"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
        </button>

        <Link
          href="/dashboard/calendar"
          title="Agenda"
          className="flex h-10 items-center gap-2 rounded-xl border border-input bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden font-medium md:inline">{todayLabel()}</span>
        </Link>
      </div>
    </header>
  );
}
