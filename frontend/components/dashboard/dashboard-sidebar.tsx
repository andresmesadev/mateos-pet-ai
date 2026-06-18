"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import {
  Home,
  Calendar,
  ShoppingCart,
  Users,
  HeartPulse,
  UserCog,
  TrendingUp,
  Settings,
  Building2,
  Bot,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

import { TenantSelector } from "@/components/dashboard/tenant-selector";
import { cn } from "@/lib/utils";

// ── Estructura de navegación ──────────────────────────────────

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
type NavSection = { heading?: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Inicio", icon: Home, exact: true },
      { href: "/dashboard/calendar", label: "Agenda", icon: Calendar },
      { href: "/dashboard/contacto", label: "Contacto", icon: Users },
      { href: "/dashboard/pos", label: "Nueva venta", icon: ShoppingCart, exact: true },
      { href: "/dashboard/recuperacion", label: "Recuperación", icon: HeartPulse },
    ],
  },
  {
    heading: "Gestión",
    items: [
      { href: "/dashboard/staff", label: "Staff", icon: UserCog },
      { href: "/dashboard/revenue", label: "Ingresos", icon: TrendingUp },
      { href: "/dashboard/settings", label: "Configuración", icon: Settings },
    ],
  },
];

const ADMIN_SECTION: NavSection = {
  heading: "Admin",
  items: [{ href: "/dashboard/admin/tenants", label: "Tenants", icon: Building2 }],
};

function isActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

// ── Item de navegación ────────────────────────────────────────

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary/15 text-sidebar-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

// ── Contenido del sidebar ─────────────────────────────────────

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const sections = session?.user?.isSuperAdmin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS;
  const userName = session?.user?.name ?? session?.user?.email ?? "Usuario";
  const role = session?.user?.isSuperAdmin ? "Super administrador" : "Administrador";

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary/15 text-xl">
          🐾
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Mateos Pet AI</p>
          <p className="truncate text-xs text-sidebar-foreground/50">Sistema Operativo</p>
        </div>
      </div>

      {/* Selector de tenant (solo superadmin) */}
      <div className="px-3 pb-2">
        <Suspense fallback={null}>
          <TenantSelector />
        </Suspense>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {sections.map((section, i) => (
          <div key={section.heading ?? i} className="space-y-1">
            {section.heading && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {section.heading}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      {/* Card Agente IA activo */}
      <div className="px-3 pb-3">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bot className="h-5 w-5 text-sidebar-primary" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-400">Agente IA activo</p>
          </div>
          <p className="mt-1 text-xs text-sidebar-foreground/60">
            Respondiendo en WhatsApp y agendando citas automáticamente.
          </p>
        </div>
      </div>

      {/* Perfil + logout */}
      <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-sm font-semibold text-sidebar-primary">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{userName}</p>
          <p className="truncate text-xs text-sidebar-foreground/50">{role}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Cerrar sesión"
          className="rounded-lg p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}

// ── Sidebar (desktop fijo + drawer móvil) ─────────────────────

export function DashboardSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Botón hamburguesa (móvil) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg border border-border bg-card p-2 text-foreground shadow-sm lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block">
        <SidebarContent />
      </aside>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
