import { BOGOTA_TIMEZONE } from "@/lib/appointments";
import { formatPhone, formatRelativeTime } from "@/lib/escalations";

export type DashboardClient = {
  id: string;
  phone: string;
  name: string | null;
  petsCount: number;
  appointmentsCount: number;
  lastConversation: {
    id: string;
    updatedAt: string;
  } | null;
  lastActivityAt: string;
  createdAt: string;
};

export type ClientPet = {
  id: string;
  name: string;
  type: string;
};

export type ClientAppointment = {
  id: string;
  petName: string;
  petType: string;
  serviceType: string;
  date: string;
  status: string;
};

export type ClientDetail = {
  id: string;
  phone: string;
  phoneAlt: string | null;
  name: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  pets: ClientPet[];
  appointments: ClientAppointment[];
  conversationsCount: number;
  latestConversationId: string | null;
};

export function formatClientRegisteredAt(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TIMEZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export { formatPhone, formatRelativeTime };
