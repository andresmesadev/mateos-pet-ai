"use client";

import { useState } from "react";
import { OpportunitiesView } from "@/components/dashboard/opportunities-view";
import { ReactivationCampaign } from "@/components/dashboard/reactivation-campaign";
import { ChurnView } from "@/components/dashboard/churn-view";
import { type RecuperacionData } from "@/app/dashboard/recuperacion/page";

type Tab = "oportunidades" | "reactivar" | "churn";

type Props = {
  data: RecuperacionData;
  initialTab: Tab;
  oppCount: number;
  inactiveCount: number;
  churnCount: number;
};

export function RecuperacionView({ data, initialTab, oppCount, inactiveCount, churnCount }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const churnHigh = data.churn.filter((c) => c.riskLevel === "high").length;
  const churnMed  = data.churn.filter((c) => c.riskLevel === "medium").length;
  const churnLow  = data.churn.filter((c) => c.riskLevel === "low").length;

  const TABS: { id: Tab; label: string; count: number; dot?: "blue" | "orange" | "red" }[] = [
    { id: "oportunidades", label: "Oportunidades", count: oppCount, dot: "blue" },
    { id: "reactivar",     label: "Reactivar",     count: inactiveCount, dot: "orange" },
    { id: "churn",         label: "Churn",         count: churnCount, dot: "red" },
  ];

  const DOT_COLOR: Record<string, string> = {
    blue:   "bg-blue-500",
    orange: "bg-orange-500",
    red:    "bg-red-500",
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border bg-muted/30 p-1 w-fit">
        {TABS.map(({ id, label, count, dot }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${tab === id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"}`}
          >
            {dot && (
              <span className={`inline-block w-2 h-2 rounded-full ${DOT_COLOR[dot]}`} />
            )}
            {label}
            {count > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold
                ${tab === id ? "bg-muted text-foreground" : "bg-muted/60 text-muted-foreground"}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "oportunidades" && (
        <OpportunitiesView data={data.opportunities} />
      )}

      {tab === "reactivar" && (
        <ReactivationCampaign clients={data.inactive} />
      )}

      {tab === "churn" && (
        <>
          {/* Resumen churn dentro del tab */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-3 rounded-xl border-t-2 border-t-red-500/60 border border-red-500/20 bg-red-500/5 px-4 py-3 min-w-[110px]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 shrink-0">
                <span className="text-xs font-bold text-red-400">!</span>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-red-300 leading-none">{churnHigh}</p>
                <p className="text-xs text-red-500 mt-0.5">Riesgo alto</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border-t-2 border-t-amber-500/60 border border-amber-500/20 bg-amber-500/5 px-4 py-3 min-w-[110px]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 shrink-0">
                <span className="text-xs font-bold text-amber-400">~</span>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-amber-300 leading-none">{churnMed}</p>
                <p className="text-xs text-amber-500 mt-0.5">Riesgo medio</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border-t-2 border-t-yellow-500/60 border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 min-w-[110px]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/15 shrink-0">
                <span className="text-xs font-bold text-yellow-400">↓</span>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-yellow-300 leading-none">{churnLow}</p>
                <p className="text-xs text-yellow-500 mt-0.5">Riesgo bajo</p>
              </div>
            </div>
          </div>

          {data.churn.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              No hay clientes en riesgo de churn todavía.
              <br />
              Se necesitan al menos 2 citas completadas por cliente para calcular el riesgo.
            </div>
          ) : (
            <ChurnView clients={data.churn} />
          )}
        </>
      )}
    </div>
  );
}
