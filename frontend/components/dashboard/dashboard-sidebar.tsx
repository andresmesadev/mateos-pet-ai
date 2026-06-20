"use client";

import { useState } from "react";
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
  Bot,
  LogOut,
  Menu,
  X,
  PawPrint,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ── Estructura de navegación ──────────────────────────────────

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
type NavSection = { heading?: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Inicio", icon: Home, exact: true },
      { href: "/dashboard/calendar", label: "Agenda", icon: Calendar },
      { href: "/dashboard/contacto", label: "Propietarios", icon: Users },
      { href: "/dashboard/conversations", label: "WhatsApp", icon: MessageCircle },
      { href: "/dashboard/pos", label: "Caja / Ventas", icon: Wallet },
      { href: "/dashboard/recuperacion", label: "Recuperación", icon: HeartPulse },
      { href: "/dashboard/settings", label: "Administración", icon: Settings },
    ],
  },
];

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
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "bg-sidebar-primary/10 text-sidebar-primary"
          : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-sidebar-primary" />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active
            ? "text-sidebar-primary"
            : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground"
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

  const sections = SECTIONS;
  const userName = session?.user?.name ?? session?.user?.email ?? "Usuario";
  const role = session?.user?.isSuperAdmin ? "Super administrador" : "Administrador";
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary/15 ring-1 ring-sidebar-primary/25">
          <PawPrint className="h-[18px] w-[18px] text-sidebar-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight tracking-tight">
            Mateos Pet AI
          </p>
          <p className="truncate text-[11px] text-sidebar-foreground/40">Panel operativo</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {sections.map((section, i) => (
          <div key={section.heading ?? i} className="space-y-0.5">
            {section.heading && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">
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
        <div className="rounded-xl border border-sidebar-primary/15 bg-gradient-to-br from-sidebar-primary/10 to-sidebar-accent/60 p-3">
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <Bot className="h-4 w-4 text-sidebar-primary" />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            </div>
            <p className="text-xs font-semibold text-emerald-400">Agente IA activo</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/55">
            Respondiendo en WhatsApp y agendando citas automáticamente.
          </p>
        </div>
      </div>

      {/* Perfil + logout */}
      <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-[11px] font-bold text-sidebar-primary ring-1 ring-sidebar-primary/20">
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
          className="rounded-lg p-1.5 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border shadow-2xl">
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
