"use client";

import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ServiceRow, TenantProfile } from "@/app/dashboard/settings/page";
import { useDashboardAccess } from "./dashboard-access-provider";
import { useTenant } from "@/lib/use-tenant";
import { homeHref } from "@/lib/home-workspace";

type SetupTab = "general" | "areas" | "localizacion" | "agenda" | "usuarios";
export function SetupGuide({ profile, services, onSelect }: { profile: TenantProfile | null; services: ServiceRow[]; onSelect: (tab: SetupTab) => void }) {
  const access = useDashboardAccess();
  const tenant = useTenant();
  if (!profile || !access?.capabilities.administration) return null;
  const appointments = profile.activeModules.some(module => ["grooming", "veterinary"].includes(module));
  const rows: { tab: SetupTab; title: string; detail: string }[] = [
    { tab: "general", title: "Datos del negocio", detail: profile.contactPhone || profile.phone ? "Nombre y teléfono disponibles; revisa los datos públicos." : "Completa los datos de contacto del establecimiento." },
    { tab: "areas", title: "Áreas habilitadas", detail: `${profile.activeModules.length} áreas activas. Elige las que ofrece este establecimiento.` },
    ...(appointments ? [{ tab: "localizacion" as const, title: "Servicios y precios", detail: `${services.filter(service => service.active && profile.activeModules.includes(service.category)).length} servicios activos en tus áreas. Revisa duración y tarifas.` }, { tab: "agenda" as const, title: "Horarios y disponibilidad", detail: "Revisa apertura, cierre y turnos antes de ofrecer citas." }] : []),
    { tab: "usuarios", title: "Equipo y accesos", detail: "Comprueba quién puede entrar, sus permisos y disponibilidad." },
  ];
  return <details className="rounded-2xl border bg-card p-5 shadow-sm">
    <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-ring"><ClipboardCheck className="size-5" aria-hidden="true" />Guía para configurar tu establecimiento</summary>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Referencias de la última carga de Administración. Revisa cada sección y guarda sus cambios; esta guía no certifica que la configuración esté completa.</p>
    <ol className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map((row, index) => <li key={row.tab} className="flex items-start gap-3 rounded-xl border p-4"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">{index + 1}</span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{row.title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.detail}</p><Button size="sm" variant="ghost" className="mt-2" onClick={() => onSelect(row.tab)}>Revisar<ArrowRight className="size-4" aria-hidden="true" /></Button></div></li>)}</ol>
    {access.capabilities.inventory_manage && <Link prefetch={false} href={homeHref("/dashboard/inventory", tenant)} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4">Revisar productos, existencias y lotes en Inventario<ArrowRight className="size-4" aria-hidden="true" /></Link>}
  </details>;
}
