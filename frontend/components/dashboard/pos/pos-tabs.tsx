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
    <nav aria-label="Secciones de caja y ventas" className="mb-6 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1 shadow-sm">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <Link
            key={id}
            href={href(id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700 sm:px-4",
              isActive
                ? "bg-teal-700 text-white"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
