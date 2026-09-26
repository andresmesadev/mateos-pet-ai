"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import {
  Home,
  Calendar,
  Wallet,
  Users,
  MessageCircle,
  HeartPulse,
  Settings,
  LogOut,
  Menu,
  X,
  PawPrint,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { proxyUrl } from "@/lib/api";

// ── Estructura de navegación ──────────────────────────────────

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; alsoActiveOn?: string[] };
type NavSection = { heading?: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    heading: "Trabajo diario",
    items: [
      { href: "/dashboard", label: "Inicio", icon: Home, exact: true },
      { href: "/dashboard/calendar", label: "Agenda", icon: Calendar },
      { href: "/dashboard/consultas", label: "Consultas veterinarias", icon: Stethoscope },
      { href: "/dashboard/contacto", label: "Clientes y mascotas", icon: Users, alsoActiveOn: ["/dashboard/clients", "/dashboard/pets"] },
      { href: "/dashboard/conversations", label: "WhatsApp", icon: MessageCircle },
    ],
  },
  {
    heading: "Gestión",
    items: [
      { href: "/dashboard/pos", label: "Caja y ventas", icon: Wallet, alsoActiveOn: ["/dashboard/revenue"] },
      { href: "/dashboard/recuperacion", label: "Recuperación", icon: HeartPulse, alsoActiveOn: ["/dashboard/churn", "/dashboard/opportunities", "/dashboard/reactivation"] },
      { href: "/dashboard/settings", label: "Administración", icon: Settings, alsoActiveOn: ["/dashboard/services", "/dashboard/staff", "/dashboard/billing", "/dashboard/admin"] },
    ],
  },
];

function isActive(item: NavItem, pathname: string) {
  if (item.exact) return pathname === item.href;
  return pathname.startsWith(item.href) || item.alsoActiveOn?.some((path) => pathname.startsWith(path)) || false;
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
        "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700",
        active
          ? "bg-teal-50 font-semibold text-teal-800"
          : "text-sidebar-foreground/75 hover:bg-slate-100 hover:text-sidebar-foreground"
      )}
    >
      {active && (
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-teal-700" />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active
            ? "text-teal-700"
            : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground"
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
  const [veterinaryEnabled, setVeterinaryEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(proxyUrl("/api/dashboard/tenant/profile"), { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((profile: { activeModules?: string[] } | null) => {
        if (!cancelled && Array.isArray(profile?.activeModules)) {
          setVeterinaryEnabled(profile.activeModules.includes("veterinary"));
        }
      })
      .catch(() => { /* Si el perfil no carga, se conserva el acceso a la sección. */ });
    return () => { cancelled = true; };
  }, []);

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.href !== "/dashboard/consultas" || veterinaryEnabled !== false),
  }));
  const userName = session?.user?.name ?? session?.user?.email ?? "Usuario";
  const role = session?.user?.isSuperAdmin ? "Super administrador" : "Administrador";
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex h-full flex-col bg-white text-sidebar-foreground"
    >
      {/* Marca */}
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-teal-700">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white">
          <PawPrint className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight tracking-tight text-teal-950">
            Mateos Pet AI
          </p>
          <p className="truncate text-xs font-medium text-sidebar-foreground/60">Tu espacio de trabajo</p>
        </div>
      </Link>

      {/* Navegación */}
      <nav aria-label="Navegación del dashboard" className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        {sections.map((section, i) => (
          <div key={section.heading ?? i} className="space-y-1">
            {section.heading && (
              <p className="px-3 pb-2 text-xs font-semibold text-sidebar-foreground/55">
                {section.heading}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      {/* Perfil + logout */}
      <div
        className="flex items-center gap-3 border-t border-sidebar-border px-4 py-3"
        style={{ background: "#f7faf9" }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary/30 to-sidebar-primary/10 text-[11px] font-bold text-sidebar-primary ring-1 ring-sidebar-primary/30">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{userName}</p>
          <p className="truncate text-[11px] text-sidebar-foreground/45">{role}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Cerrar sesión"
          className="rounded-lg p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-black/[0.06] hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
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
        className="fixed left-4 top-4 z-40 rounded-lg border border-border bg-white p-2 text-foreground shadow-sm lg:hidden"
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
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-sidebar-foreground/60 hover:bg-black/[0.06]"
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
