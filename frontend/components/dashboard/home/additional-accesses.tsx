"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function AdditionalAccesses({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <div className="mt-4 border-t border-slate-100 pt-3">
    <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-700 lg:hidden">
      Más accesos<ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    <div id={id} className={`mt-3 flex-wrap items-center gap-x-5 gap-y-2 lg:mt-0 lg:flex ${expanded ? "flex" : "hidden"}`}>
      {children}
    </div>
  </div>;
}
