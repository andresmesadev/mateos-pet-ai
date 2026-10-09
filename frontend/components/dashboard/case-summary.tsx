"use client";

import { Badge } from "@/components/ui/badge";
import { useDashboardAccess } from "./dashboard-access-provider";
import { formatColombiaDateTime, formatService, formatStatus, statusBadgeClass, type TodayAppointment } from "@/lib/appointments";

/** Operational identity only: clinical and grooming notes stay in their authorized screens. */
export function CaseSummary({ appointment, showPrice = false }: { appointment: TodayAppointment; showPrice?: boolean }) {
  const access = useDashboardAccess();
  const rows = [
    ["Mascota", appointment.petName],
    ["Propietario", appointment.clientName || "Sin nombre registrado"],
    ["Servicio", appointment.serviceName || formatService(appointment.serviceType)],
    ["Fecha · hora de Colombia", formatColombiaDateTime(appointment.date)],
    ["Profesional", appointment.staffName || "Sin asignar"],
  ];
  if (showPrice && (access?.capabilities.cash || access?.capabilities.appointmentPrice)) rows.push(["Precio de esta cita (COP)", appointment.finalPrice == null ? "Sin precio definido" : `$ ${appointment.finalPrice.toLocaleString("es-CO")}`]);
  return <section aria-label="Resumen de la atención" className="rounded-xl border border-border bg-muted/30 p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Datos de esta visita</h3><Badge className={statusBadgeClass(appointment.status)}>{formatStatus(appointment.status)}</Badge></div>
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}</dl>
  </section>;
}
