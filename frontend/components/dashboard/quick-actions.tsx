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

type Action = {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
  border: string;
};

const ACTIONS: Action[] = [
  { href: "/dashboard/pos?tab=venta",    title: "Nueva venta",     subtitle: "Registrar cobro",    icon: ShoppingCart, tint: "bg-teal-500/15 text-teal-400",    border: "border-t-teal-500/50" },
  { href: "/dashboard/clients",          title: "Nuevo cliente",   subtitle: "Registrar cliente",  icon: UserPlus,     tint: "bg-violet-500/15 text-violet-400",  border: "border-t-violet-500/50" },
  { href: "/dashboard/pets",             title: "Nueva mascota",   subtitle: "Registrar mascota",  icon: PawPrint,     tint: "bg-amber-500/15 text-amber-400",    border: "border-t-amber-500/50" },
  { href: "/dashboard/conversations",    title: "Conversaciones",  subtitle: "Atención humana",    icon: MessageSquare,tint: "bg-emerald-500/15 text-emerald-400", border: "border-t-emerald-500/50" },
  { href: "/dashboard/pos?tab=historial",title: "Historial",       subtitle: "Ver ingresos",       icon: History,      tint: "bg-sky-500/15 text-sky-400",        border: "border-t-sky-500/50" },
];

export function QuickActions() {
  return (
    <div className="rounded-xl border border-white/[0.1] bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Acciones rápidas</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className={`group flex flex-col gap-3 rounded-xl border-t-2 border border-white/[0.08] bg-background/50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.15] hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.5)] ${a.border}`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-white/[0.1] transition-transform duration-200 group-hover:scale-110 ${a.tint}`}>
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
