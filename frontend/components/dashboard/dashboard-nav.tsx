"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TenantSelector } from "@/components/dashboard/tenant-selector";
import { cn } from "@/lib/utils";

const isSuperAdmin = process.env.NEXT_PUBLIC_SUPER_ADMIN === "true";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio", exact: true },
  { href: "/dashboard/clients", label: "Clientes", exact: false },
  { href: "/dashboard/conversations", label: "Conversaciones", exact: false },
  { href: "/dashboard/pets", label: "Mascotas", exact: false },
  { href: "/dashboard/reactivation", label: "Reactivar", exact: false },
  { href: "/dashboard/services", label: "Servicios", exact: false },
  ...(isSuperAdmin
    ? [{ href: "/dashboard/admin/tenants", label: "Admin", exact: false }]
    : []),
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap items-center gap-2">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Button
            key={item.href}
            asChild
            size="sm"
            variant={isActive ? "default" : "outline"}
          >
            <Link
              href={item.href}
              className={cn(isActive && "pointer-events-none")}
            >
              {item.label}
            </Link>
          </Button>
        );
      })}
      <div className="ml-auto">
        <TenantSelector />
      </div>
    </nav>
  );
}
