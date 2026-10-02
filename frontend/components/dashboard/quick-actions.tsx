import Link from "next/link";
import {
  CalendarPlus,
  ShoppingCart,
  UserPlus,
  PawPrint,
  MessageSquare,
  History,
  ArrowUpRight,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

type Action = {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
};

const PRIMARY_ACTIONS: Action[] = [
  { href: "/dashboard/calendar?new=1", title: "Nueva cita", subtitle: "Agendar manualmente", icon: CalendarPlus, tint: "bg-teal-50 text-teal-700" },
  { href: "/dashboard/pos?tab=venta", title: "Nueva venta", subtitle: "Registrar cobro", icon: ShoppingCart, tint: "bg-teal-50 text-teal-700" },
  { href: "/dashboard/contacto?new=cliente", title: "Nuevo cliente", subtitle: "Registrar cliente", icon: UserPlus, tint: "bg-sky-50 text-sky-700" },
];

const SECONDARY_ACTIONS: Action[] = [
  { href: "/dashboard/contacto?new=mascota", title: "Nueva mascota", subtitle: "Registrar mascota", icon: PawPrint, tint: "bg-amber-50 text-amber-700" },
  { href: "/dashboard/conversations", title: "Conversaciones", subtitle: "Atención humana", icon: MessageSquare, tint: "bg-emerald-50 text-emerald-700" },
  { href: "/dashboard/pos?tab=historial", title: "Historial", subtitle: "Ver ingresos", icon: History, tint: "bg-slate-100 text-slate-700" },
];

export function QuickActions({ tenant, schedule = true }: { tenant?: string; schedule?: boolean }) {
  return (
    <section aria-labelledby="quick-actions-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h2 id="quick-actions-heading" className="text-lg font-bold tracking-tight">Acciones rápidas</h2>
        <p className="text-sm text-muted-foreground">Las tareas más comunes, a un clic.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {PRIMARY_ACTIONS.filter(a => schedule || !a.href.startsWith("/dashboard/calendar")).map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href.startsWith("/dashboard/calendar?") && tenant ? `${a.href}&tenant=${encodeURIComponent(tenant)}` : a.href}
              className="group flex min-h-20 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition-colors hover:border-teal-300 hover:bg-teal-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${a.tint}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.subtitle}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-teal-700" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
        {SECONDARY_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href} className="group inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-teal-700 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
              <Icon className="h-4 w-4" aria-hidden="true" />
              {a.title}
              <ArrowRight className="h-3.5 w-3.5 opacity-50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
