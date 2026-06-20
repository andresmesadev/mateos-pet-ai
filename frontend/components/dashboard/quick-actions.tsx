import Link from "next/link";
import {
  ShoppingCart,
  UserPlus,
  PawPrint,
  MessageSquare,
  History,
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
  { href: "/dashboard/pos?tab=venta", title: "Nueva venta", subtitle: "Registrar cobro", icon: ShoppingCart, tint: "bg-teal-500/15 text-teal-400" },
  { href: "/dashboard/clients", title: "Nuevo cliente", subtitle: "Registrar cliente", icon: UserPlus, tint: "bg-violet-500/15 text-violet-400" },
  { href: "/dashboard/pets", title: "Nueva mascota", subtitle: "Registrar mascota", icon: PawPrint, tint: "bg-amber-500/15 text-amber-400" },
  { href: "/dashboard/conversations", title: "Conversaciones", subtitle: "Atención humana", icon: MessageSquare, tint: "bg-emerald-500/15 text-emerald-400" },
  { href: "/dashboard/pos?tab=historial", title: "Historial", subtitle: "Ver ingresos", icon: History, tint: "bg-sky-500/15 text-sky-400" },
];

export function QuickActions() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-card p-5 shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Acciones rápidas</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-background/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-110 ${a.tint}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.subtitle}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
