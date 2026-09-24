import Link from "next/link";
import {
  ShoppingCart,
  UserPlus,
  PawPrint,
  MessageSquare,
  History,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

type Action = {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
};

const ACTIONS: Action[] = [
  { href: "/dashboard/pos?tab=venta", title: "Nueva venta", subtitle: "Registrar cobro", icon: ShoppingCart, tint: "bg-teal-50 text-teal-700" },
  { href: "/dashboard/contacto?new=cliente", title: "Nuevo cliente", subtitle: "Registrar cliente", icon: UserPlus, tint: "bg-sky-50 text-sky-700" },
  { href: "/dashboard/contacto?new=mascota", title: "Nueva mascota", subtitle: "Registrar mascota", icon: PawPrint, tint: "bg-amber-50 text-amber-700" },
  { href: "/dashboard/conversations", title: "Conversaciones", subtitle: "Atención humana", icon: MessageSquare, tint: "bg-emerald-50 text-emerald-700" },
  { href: "/dashboard/pos?tab=historial", title: "Historial", subtitle: "Ver ingresos", icon: History, tint: "bg-slate-100 text-slate-700" },
];

export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h2 id="quick-actions-heading" className="text-lg font-bold tracking-tight">Acciones rápidas</h2>
        <p className="text-sm text-muted-foreground">Las tareas más comunes, a un clic.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex min-h-28 flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition-colors hover:border-teal-300 hover:bg-teal-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.tint}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400 transition-colors group-hover:text-teal-700" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.subtitle}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
