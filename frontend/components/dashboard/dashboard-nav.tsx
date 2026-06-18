"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { TenantSelector } from "@/components/dashboard/tenant-selector";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────

type NavItem = { href: string; label: string; exact?: boolean };

type NavGroup = {
  label: string;
  items: NavItem[];
};

type TopLevel = NavItem & { group?: never };
type Entry = TopLevel | ({ group: true } & NavGroup);

// ── Nav structure ─────────────────────────────────────────────

const NAV: Entry[] = [
  { href: "/dashboard",          label: "Inicio",      exact: true },
  { href: "/dashboard/calendar", label: "Calendario" },
  { href: "/dashboard/pos",      label: "Nueva venta", exact: true },
  {
    group: true,
    label: "Contacto",
    items: [
      { href: "/dashboard/clients", label: "Clientes" },
      { href: "/dashboard/pets",    label: "Mascotas" },
    ],
  },
  {
    group: true,
    label: "Comunicación",
    items: [
      { href: "/dashboard/conversations",  label: "Conversaciones" },
      { href: "/dashboard/recuperacion",   label: "Recuperación" },
    ],
  },
  {
    group: true,
    label: "Gestión",
    items: [
      { href: "/dashboard/staff",       label: "Staff" },
      { href: "/dashboard/services",    label: "Servicios" },
      { href: "/dashboard/revenue",     label: "Ingresos" },
      { href: "/dashboard/settings",    label: "Configuración" },
      { href: "/dashboard/billing",     label: "Plan y facturación" },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  label: "Admin",
  items: [{ href: "/dashboard/admin/tenants", label: "Tenants" }],
};

// ── Helpers ───────────────────────────────────────────────────

function isItemActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function isGroupActive(group: NavGroup, pathname: string) {
  return group.items.some((i) => isItemActive(i, pathname));
}

// ── Dropdown group ────────────────────────────────────────────

function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = isGroupActive(group, pathname);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        variant={active ? "default" : "outline"}
        onClick={() => setOpen((o) => !o)}
        className="gap-1"
      >
        {group.label}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border bg-background shadow-lg py-1">
          {group.items.map((item) => {
            const itemActive = isItemActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block px-3 py-2 text-sm transition-colors hover:bg-muted",
                  itemActive ? "font-semibold text-foreground bg-muted/60" : "text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main nav ──────────────────────────────────────────────────

export function DashboardNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const entries: Entry[] = session?.user?.isSuperAdmin
    ? [...NAV, { group: true as const, ...ADMIN_GROUP }]
    : NAV;

  return (
    <nav className="mb-8 flex flex-wrap items-center gap-2">
      {entries.map((entry) => {
        if ("group" in entry && entry.group) {
          return <NavDropdown key={entry.label} group={entry} pathname={pathname} />;
        }

        const item = entry as TopLevel;
        const active = isItemActive(item, pathname);
        return (
          <Button
            key={item.href}
            asChild
            size="sm"
            variant={active ? "default" : "outline"}
          >
            <Link href={item.href} className={cn(active && "pointer-events-none")}>
              {item.label}
            </Link>
          </Button>
        );
      })}

      <div className="ml-auto">
        <Suspense fallback={null}>
          <TenantSelector />
        </Suspense>
      </div>
    </nav>
  );
}
