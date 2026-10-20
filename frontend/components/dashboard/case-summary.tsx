"use client";

import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";
import { useDashboardAccess } from "./dashboard-access-provider";
import { formatColombiaDateTime, formatService, formatStatus, statusBadgeClass, type TodayAppointment } from "@/lib/appointments";

/** Operational identity only: clinical and grooming notes stay in their authorized screens. */
export function CaseSummary({ appointment, showPrice = false, compact = false, actions }: { appointment: TodayAppointment; showPrice?: boolean; compact?: boolean; actions?: ReactNode }) {
  const access = useDashboardAccess();
  const rows = [
    ["Mascota", appointment.petName],
    ["Propietario", appointment.clientName || "Sin nombre registrado"],
    ["Servicio", appointment.serviceName || formatService(appointment.serviceType)],
    ["Fecha · hora de Colombia", formatColombiaDateTime(appointment.date)],
    ["Profesional", appointment.staffName || "Sin asignar"],
  ];
  const visibleRows = compact ? rows.filter(([label]) => !["Mascota", "Servicio"].includes(label)) : rows;
  if (showPrice && (access?.capabilities.cash || access?.capabilities.appointmentPrice)) {
    if (appointment.transport && appointment.transport.mode !== "none") {
      visibleRows.push(["Peluquería (COP)", appointment.priceResolution?.servicePrice == null ? "Pendiente" : `$ ${appointment.priceResolution.servicePrice.toLocaleString("es-CO")}`]);
      visibleRows.push(["Transporte (COP)", appointment.transport.pending ? "Por confirmar" : appointment.transport.mode === "shared" ? "Incluido en otra cita" : appointment.transport.price == null ? "Pendiente" : `$ ${appointment.transport.price.toLocaleString("es-CO")}`]);
    }
    visibleRows.push(["Total de esta cita (COP)", appointment.finalPrice == null ? "Sin precio definido" : `$ ${appointment.finalPrice.toLocaleString("es-CO")}`]);
  }
  return <section aria-label="Resumen de la atención" className={`rounded-xl border border-border p-4 ${compact ? "bg-white sm:p-5" : "bg-muted/30"}`}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{compact ? "Datos de la cita" : "Datos de esta visita"}</h3>{actions}{!compact && <Badge className={statusBadgeClass(appointment.status)}>{formatStatus(appointment.status)}</Badge>}</div>
    <dl className={`grid gap-x-5 gap-y-4 ${compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>{visibleRows.map(([label, value]) => {
      const total = compact && label === "Total de esta cita (COP)";
      return <div key={label} className={`min-w-0 ${total ? "col-span-2 rounded-lg bg-accent/60 p-3" : ""}`}><dt className="text-xs text-muted-foreground">{label}</dt><dd className={`mt-1 break-words font-semibold ${total ? "text-xl tabular-nums text-primary" : "text-sm"}`}>{value}</dd></div>;
    })}</dl>
  </section>;
}
