import Link from "next/link";
import {
  ShoppingCart,
  UserPlus,
  PawPrint,
  MessageSquare,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";

type Action = {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
};

// Nota: el agendamiento de citas es responsabilidad del agente WhatsApp (NLP),
// por eso aquí no hay acción de "Nueva cita".
const ACTIONS: Action[] = [
  { href: "/dashboard/pos", title: "Nueva venta", subtitle: "Registrar venta / POS", icon: ShoppingCart, tint: "bg-teal-500/15 text-teal-400" },
  { href: "/dashboard/clients", title: "Nuevo cliente", subtitle: "Registrar cliente", icon: UserPlus, tint: "bg-violet-500/15 text-violet-400" },
  { href: "/dashboard/pets", title: "Nueva mascota", subtitle: "Registrar mascota", icon: PawPrint, tint: "bg-amber-500/15 text-amber-400" },
  { href: "/dashboard/conversations", title: "Conversaciones", subtitle: "Atención humana", icon: MessageSquare, tint: "bg-emerald-500/15 text-emerald-400" },
  { href: "/dashboard/revenue", title: "Ingresos", subtitle: "Ver reportes", icon: TrendingUp, tint: "bg-sky-500/15 text-sky-400" },
];

export function QuickActions() {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Acciones rápidas</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.tint}`}>
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
    </Card>
  );
}
