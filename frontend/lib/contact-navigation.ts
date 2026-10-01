import type { TodayAppointment } from "@/lib/appointments";

export function appointmentDay(iso: string): string | undefined {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

export function consultationHref(appointment: { id: string; date: string }, tenant?: string | null): string {
  const params = new URLSearchParams({ appointment: appointment.id });
  const date = appointmentDay(appointment.date);
  if (date) params.set("date", date);
  if (tenant) params.set("tenant", tenant);
  return `/dashboard/consultas?${params}`;
}

export function ownerAgendaHref(clientId: string, tenant?: string | null, appointmentDate?: string): string {
  const params = new URLSearchParams({ client: clientId });
  const date = appointmentDate ? appointmentDay(appointmentDate) : undefined;
  if (date) params.set("date", date);
  if (tenant) params.set("tenant", tenant);
  return `/dashboard/calendar?${params}`;
}

// An identifier matches the owner; names, phones and current pet ownership do not.
export function filterOwnerAppointments<T extends Pick<TodayAppointment, "userId">>(appointments: T[], clientId?: string): T[] {
  return clientId ? appointments.filter((item) => item.userId === clientId) : appointments;
}
