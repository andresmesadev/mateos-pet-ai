export const AGENDA_PAGE_SIZE = 10;

export function visibleAgendaAppointments<T extends { status: string }>(appointments: T[]): T[] {
  return appointments.filter(appointment => appointment.status !== "cancelled");
}

export function agendaPage<T>(appointments: T[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(appointments.length / AGENDA_PAGE_SIZE));
  const page = Math.max(1, Math.min(Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1, pages));
  const start = (page - 1) * AGENDA_PAGE_SIZE;
  return { page, pages, total: appointments.length, start: appointments.length ? start + 1 : 0,
    end: Math.min(start + AGENDA_PAGE_SIZE, appointments.length),
    appointments: appointments.slice(start, start + AGENDA_PAGE_SIZE) };
}
