"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const PATH_LABELS: Record<string, string> = {
  calendar: "Agenda",
  contacto: "Clientes",
  conversations: "WhatsApp",
  pos: "Nueva venta",
  recuperacion: "Recuperación",
  revenue: "Ingresos",
  settings: "Configuración",
  clients: "Clientes",
  pets: "Mascotas",
  churn: "Análisis de churn",
  opportunities: "Próximas acciones",
  reactivation: "Campaña de reactivación",
  billing: "Facturación",
  staff: "Personal",
  services: "Servicios",
  admin: "Administración",
  tenants: "Tenants",
};

export function BreadcrumbNav() {
  const pathname = usePathname();

  if (pathname === "/dashboard") return null;

  const segments = pathname.replace("/dashboard", "").split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="Ruta de navegación"
      className="mb-5 flex items-center gap-1 text-xs text-muted-foreground"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Inicio</span>
      </Link>

      {segments.map((seg, i) => {
        const href = `/dashboard/${segments.slice(0, i + 1).join("/")}`;
        const label = PATH_LABELS[seg] ?? seg;
        const isLast = i === segments.length - 1;

        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="transition-colors hover:text-foreground">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
