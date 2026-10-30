"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ServiceRow, TenantProfile } from "@/app/dashboard/settings/page";
import { useDashboardAccess } from "./dashboard-access-provider";
import { useTenant } from "@/lib/use-tenant";
import { homeHref } from "@/lib/home-workspace";

type SetupTab = "general" | "areas" | "localizacion" | "agenda" | "usuarios";
type Step = { id: string; title: string; detail: string; action: string; status?: string; tab?: SetupTab; href?: string };
export function SetupGuide({ profile, services, onSelect, startOpen = false }: { profile: TenantProfile | null; services: ServiceRow[]; onSelect: (tab: SetupTab) => void; startOpen?: boolean }) {
  const access = useDashboardAccess();
  const tenant = useTenant();
  const [expanded, setExpanded] = useState(startOpen);
  if (!profile || !access?.capabilities.administration) return null;
  const appointments = profile.activeModules.some(module => ["grooming", "veterinary"].includes(module));
  const bookable = services.filter(service => service.active && service.requiresAppointment && profile.activeModules.includes(service.bookingCategory ?? service.category));
  const hasContact = Boolean(profile.contactPhone?.trim());
  const hasHours = Boolean(profile.businessHours && Object.keys(profile.businessHours).length);
  const hasOpenDays = Boolean(profile.businessHours && [profile.businessHours, ...Object.values(profile.businessHours.services ?? {})].some(hours => Object.values(hours).some(day => day && typeof day === "object" && "active" in day && day.active === true)));
  const rows: Step[] = [
    { id: "business", tab: "general", title: "Datos del negocio", status: hasContact ? "Contacto guardado" : "Falta teléfono de contacto", detail: "Revisa el nombre, la dirección y cómo pueden contactar a este establecimiento.", action: "Revisar datos" },
    { id: "areas", tab: "areas", title: "Áreas habilitadas", status: `${profile.activeModules.length} ${profile.activeModules.length === 1 ? "área activa" : "áreas activas"}`, detail: "Elige Veterinaria, Peluquería o Pet shop. Activa también Pet shop si venderás productos.", action: "Elegir áreas" },
    ...(appointments ? [
      { id: "services", tab: "localizacion" as const, title: "Servicios y precios", status: bookable.length ? `${bookable.length} ${bookable.length === 1 ? "servicio con cita" : "servicios con cita"}` : "Faltan servicios con cita", detail: "Crea tus servicios y define cuáles requieren cita y su duración. Peluquería necesita precio antes de finalizar; los demás pueden valorarse al cobrar. Marca cuáles se reparten por porcentaje.", action: "Preparar servicios" },
      { id: "hours", tab: "agenda" as const, title: "Horarios y disponibilidad", status: !hasHours ? "Falta horario propio" : hasOpenDays ? "Horario guardado: revisar días" : "Sin días de atención", detail: "Define días y horas de atención. Un negocio nuevo comienza sin días abiertos hasta que guarde su horario. Puedes usar un horario general o uno por área; revisa también los turnos del equipo.", action: "Configurar horarios" },
    ] : []),
    { id: "team", tab: "usuarios", title: "Equipo y accesos", detail: appointments ? "Registra a quienes atienden y crea accesos individuales. Revisa permisos, tipo de contrato y porcentaje del profesional; no todos los servicios generan comisión." : "Puedes empezar con tu cuenta. Si alguien más usa el sistema, crea su acceso y revisa sus permisos.", action: "Preparar equipo" },
    ...(access.capabilities.inventory_manage ? [{ id: "inventory", href: "/dashboard/inventory", title: "Productos y existencias", detail: profile.activeModules.includes("retail") ? "Crea productos con precio y uso Pet shop para venderlos. Registra la existencia inicial real; agrega lote y vencimiento cuando corresponda." : "Registra los insumos del área y sus existencias. Un consumo descuenta unidades; no crea una venta. Para vender productos, activa Pet shop.", action: "Preparar inventario" }] : []),
    ...(access.capabilities.cash ? [{ id: "opening", href: "/dashboard/pos?tab=caja", title: "Base de caja", detail: "Confirma el efectivo con el que comienza la jornada, incluso si es $0. Si hay un cierre anterior, revisa la base sugerida. No se suma como ingreso.", action: "Confirmar base" }] : []),
    { id: "first-operation", href: appointments ? "/dashboard/calendar?new=1" : "/dashboard/pos?tab=venta", title: appointments ? "Primera atención y cobro" : "Primera venta", detail: appointments ? "Registra cliente y mascota, agenda y atiende la cita. Al cobrar, revisa artículos, profesional e importes; puedes combinar efectivo y transferencia." : "Agrega los productos vendidos y confirma el pago. El cliente es opcional; puedes combinar efectivo y transferencia.", action: appointments ? "Ir a Agenda" : "Ir a Cobrar" },
    ...(access.capabilities.finance ? [{ id: "close", href: "/dashboard/pos?tab=caja", title: "Revisar y cerrar el día", detail: "Compara cobros, efectivo, transferencias, gastos y comisiones con lo ocurrido. Revisa existencias y cuánto efectivo dejas. Confirma el cierre cuando los valores coincidan.", action: "Revisar jornada" }] : []),
  ];
  return <details id="setup-guide" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} className="rounded-2xl border bg-card p-5 shadow-sm">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-ring"><ClipboardCheck className="size-5 shrink-0" aria-hidden="true" />Guía para configurar tu establecimiento</summary>
    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Prepara tu negocio y sigue el recorrido hasta el primer cierre. Guarda los cambios en cada sección. Puedes volver a esta guía desde Inicio, en «Preparar mi negocio».</p>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Las referencias corresponden a la última carga de Administración. Los pasos «Por revisar» requieren tu comprobación; abrirlos no los marca como terminados.</p>
    <ol aria-label="Pasos para empezar a operar" className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map((row, index) => <li key={row.id} data-setup-step={row.id} className="flex items-start gap-3 rounded-xl border p-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold" aria-hidden="true">{index + 1}</span>
      <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{row.title}</h2><p className="mt-1 text-xs font-medium text-primary">{row.status ?? "Por revisar"}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{row.detail}</p>
        {row.tab ? <Button type="button" size="sm" variant="ghost" className="mt-2 min-h-11 max-w-full whitespace-normal text-left" onClick={() => onSelect(row.tab!)}>{row.action}<ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Button> : <Link prefetch={false} href={homeHref(row.href!, tenant)} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">{row.action}<ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link>}
      </div>
    </li>)}</ol>
    <p className="mt-4 text-sm text-muted-foreground">WhatsApp e IA pueden configurarse después. Puedes operar manualmente con las áreas habilitadas.</p>
  </details>;
}
