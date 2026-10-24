"use client";

import { useRef, useState } from "react";
import { Check, LogIn, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionConfirmation } from "./action-confirmation";
import { useDashboardAccess } from "./dashboard-access-provider";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";
import { arrivalWindowExpired, isGroomingAppointment, type TodayAppointment } from "@/lib/appointments";
import { AppointmentPaymentLink } from './appointment-payment-link';
import { useGroomerSelection } from './use-groomer-selection';

export function AppointmentQuickActions({ appointment, onUpdated }: { appointment: TodayAppointment; onUpdated: (value: TodayAppointment) => void }) {
  const access = useDashboardAccess(); const tenant = useTenant();
  const { confirm, confirmation } = useActionConfirmation();
  const groomerSelection = useGroomerSelection(onUpdated);
  const lock = useRef(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const admin = access?.capabilities.administration;
  const own = admin || !appointment.staffId || appointment.staffId === access?.staffId;
  const professional = admin || (own && (access?.capabilities.clinical || access?.capabilities.grooming));
  const previousDay = appointment.status === "arrived" && new Date(appointment.date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) < new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const action = ["pending", "confirmed"].includes(appointment.status) && !arrivalWindowExpired(appointment.date) && (admin || access?.capabilities.schedule || professional)
    ? { status: "arrived", label: "Llegó", icon: LogIn }
    : appointment.status === "arrived" && professional && (!previousDay || admin)
      ? { status: "in_progress", label: "En atención", icon: Play }
      : appointment.status === "in_progress" && professional
        ? { status: "completed", label: "Finalizar", icon: Check } : null;
  async function update(skipConfirmation = false) {
    if (!action || lock.current) return;
    lock.current = true;
    try {
      if (!skipConfirmation && action.status === "in_progress" && previousDay && !await confirm("Esta llegada pertenece a un día anterior. ¿Confirmas que hubo atención y vas a regularizar su registro?")) return;
      if (!skipConfirmation && action.status === "completed" && !await confirm(`¿Finalizar la atención de ${appointment.petName}? El pago se confirma en Caja.${appointment.serviceCategory === "grooming" || appointment.serviceType === "grooming" ? " La entrega de la mascota se registra por separado en Peluquería." : ""}`)) return;
      setBusy(true); setError("");
      const complete = action.status === "completed";
      const response = await fetch(proxyUrl(`/api/dashboard/appointments/${appointment.id}${complete ? "/complete" : ""}${tenantQuery(tenant)}`), {
        method: complete ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(complete ? {} : { status: action.status }),
      });
      const value = await response.json();
      if (!response.ok && groomerSelection.ask(appointment, value, () => void update(true))) return;
      if (!response.ok) throw new Error(value.error ?? "No se pudo actualizar la atención.");
      if (value.id !== appointment.id || value.status !== action.status) throw new Error("Actualiza la agenda para comprobar el resultado antes de repetir la acción.");
      onUpdated(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo comprobar el resultado. Actualiza la agenda."); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!action) return <AppointmentPaymentLink appointment={appointment} />;
  const Icon = action.icon;
  return <div className="flex flex-wrap items-center gap-2">{confirmation}{groomerSelection.dialog}<Button type="button" size="sm" variant="outline" aria-label={`${action.label}: ${appointment.petName}`} disabled={busy || (action.status === "completed" && isGroomingAppointment(appointment) && (appointment.hasResolvedPrice === false || appointment.transport?.pending))} onClick={() => void update()}><Icon aria-hidden="true" className="size-4" />{busy ? "Guardando…" : action.label}</Button>{error && <p role="alert" className="max-w-xs text-xs text-red-700">{error}</p>}</div>;
}
