"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShoppingCart, Wallet, TrendingDown, History, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { readReportDetail, reportReturnUrl } from "@/lib/pos-reports";

export type PosTab = "venta" | "caja" | "egreso" | "historial" | "reportes";

const TABS: { id: PosTab; label: string; icon: React.ElementType }[] = [
  { id: "venta",    label: "Cobrar",  icon: ShoppingCart },
  { id: "caja",     label: "Caja diaria", icon: Wallet },
  { id: "egreso",   label: "Gastos",       icon: TrendingDown },
  { id: "historial",label: "Historial de cobros",    icon: History },
  { id: "reportes", label: "Reportes",     icon: BarChart3 },
];

export function PosTabs({ active }: { active: PosTab }) {
  const searchParams = useSearchParams();
  const access = useDashboardAccess();

  function href(tab: PosTab) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    if (tab === active) return `/dashboard/pos?${p.toString()}`;
    const detail = readReportDetail(Object.fromEntries(searchParams.entries()));
    if (tab === "reportes" && detail) return reportReturnUrl(detail.selection, searchParams.get("tenant"));
    // Detail dates and filters belong only to the report link that opened them.
    for (const key of ["from", "to", "source", "detail", "reportPeriod", "reportOffset", "offset", "comparison"]) p.delete(key);
    p.delete("period");
    p.delete("date");
    return `/dashboard/pos?${p.toString()}`;
  }

  return (
    <nav aria-label="Secciones del punto de venta" className="mb-6 flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-white p-1 shadow-sm">
      {TABS.filter(tab => access?.capabilities.finance || ["venta", "caja"].includes(tab.id)).map(({ id, label, icon: Icon }) => {
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
