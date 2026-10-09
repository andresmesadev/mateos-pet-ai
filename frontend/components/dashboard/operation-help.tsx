"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { useDashboardAccess } from "./dashboard-access-provider";
import { useTenant } from "@/lib/use-tenant";
import { homeHref } from "@/lib/home-workspace";
import { operationGuides } from "@/lib/operation-guides";

export function OperationHelp() {
  const access = useDashboardAccess();
  const pathname = usePathname();
  const tenant = useTenant();
  if (!access) return null;
  const guides = operationGuides(access).filter(guide => pathname === "/dashboard" || pathname === guide.path.split("?")[0]);
  if (!guides.length) return null;
  return <details className="mt-8 rounded-xl border bg-card p-4">
    <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-ring"><CircleHelp className="size-4" aria-hidden="true" />Ayuda para tu operación diaria</summary>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{guides.map(guide => <article key={guide.id} className="rounded-lg bg-muted/30 p-4"><h2 className="text-sm font-semibold">{guide.title}</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">{guide.steps.map(step => <li key={step}>{step}</li>)}</ol><Link prefetch={false} href={homeHref(guide.path, tenant)} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary underline underline-offset-4">Abrir {guide.id === "pos" ? "Caja" : guide.id === "consultas" ? "Consultas veterinarias" : guide.id === "peluqueria" ? "Peluquería" : "Agenda"}</Link></article>)}</div>
  </details>;
}
