"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShoppingCart, Wallet, TrendingDown, History, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PosTab = "venta" | "caja" | "egreso" | "historial" | "reportes";

const TABS: { id: PosTab; label: string; icon: React.ElementType }[] = [
  { id: "venta",    label: "Nueva venta",  icon: ShoppingCart },
  { id: "caja",     label: "Caja del día", icon: Wallet },
  { id: "egreso",   label: "Egreso",       icon: TrendingDown },
  { id: "historial",label: "Historial",    icon: History },
  { id: "reportes", label: "Reportes",     icon: BarChart3 },
];

export function PosTabs({ active }: { active: PosTab }) {
  const searchParams = useSearchParams();

  function href(tab: PosTab) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    // Reset period/date when switching tabs
    p.delete("period");
    p.delete("date");
    return `/dashboard/pos?${p.toString()}`;
  }

  return (
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-card p-1">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <Link
            key={id}
            href={href(id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-primary/15 text-primary shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
