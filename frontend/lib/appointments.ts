export const BOGOTA_TIMEZONE = "America/Bogota";

export type TodayAppointment = {
  id: string;
  date: string;
  status: AppointmentStatus;
  serviceType: string;
  petName: string;
  petType: string;
  clientPhone: string;
  clientName: string | null;
};

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | string;

export type AppointmentPet = {
  id: string;
  name: string;
  type: string;
};

export type Appointment = {
  id: string;
  userId: string;
  petId: string | null;
  petName: string;
  petType: string;
  pet?: AppointmentPet | null;
  serviceType: string;
  date: string;
  status: AppointmentStatus;
  createdAt: string;
};

export type DateFilter = "today" | "week" | "all";

const PET_TYPE_LABELS: Record<string, string> = {
  dog: "Perro",
  cat: "Gato",
  other: "Otro",
};

const SERVICE_LABELS: Record<string, string> = {
  vet: "Consulta veterinaria",
  grooming: "Baño / Grooming",
  general_appointment: "Cita general",
  medication: "Medicamentos",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmada",
  pending: "Pendiente",
  cancelled: "Cancelada",
};

export function formatColombiaTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatColombiaDateTime(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const datePart = new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${datePart} ${timePart}`;
}

export function formatPet(petName: string, petType: string): string {
  const typeLabel = PET_TYPE_LABELS[petType?.toLowerCase()] ?? petType;
  return `${petName} (${typeLabel})`;
}

export function formatAppointmentPet(appointment: Appointment): string {
  if (appointment.pet) {
    return formatPet(appointment.pet.name, appointment.pet.type);
  }

  return formatPet(appointment.petName, appointment.petType);
}

export function formatService(serviceType: string): string {
  return (
    SERVICE_LABELS[serviceType?.toLowerCase()] ??
    serviceType.replace(/_/g, " ")
  );
}

export function formatStatus(status: AppointmentStatus): string {
  return STATUS_LABELS[status?.toLowerCase()] ?? status;
}

export function formatClient(userId: string): string {
  if (!userId) return "—";
  if (userId.length <= 10) return userId;
  return `${userId.slice(0, 8)}…`;
}

export function statusBadgeClass(status: AppointmentStatus): string {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300";
    case "pending":
      return "border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300";
    case "cancelled":
      return "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function getZonedYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getDayOfWeekBogota(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TIMEZONE,
    weekday: "short",
  }).format(date);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[weekday] ?? 0;
}

function daysDiffInBogota(from: Date, to: Date): number {
  const [fy, fm, fd] = getZonedYmd(from).split("-").map(Number);
  const [ty, tm, td] = getZonedYmd(to).split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((fromMs - toMs) / 86_400_000);
}

export function isTodayInBogota(iso: string): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return getZonedYmd(date) === getZonedYmd(new Date());
}

export function isThisWeekInBogota(iso: string): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  const diff = daysDiffInBogota(date, today);
  const dow = getDayOfWeekBogota(today);
  const mondayDiff = dow === 0 ? -6 : 1 - dow;
  const sundayDiff = dow === 0 ? 0 : 7 - dow;

  return diff >= mondayDiff && diff <= sundayDiff;
}

export function filterAppointments(
  appointments: Appointment[],
  filter: DateFilter
): Appointment[] {
  if (filter === "all") {
    return appointments;
  }

  if (filter === "today") {
    return appointments.filter((a) => isTodayInBogota(a.date));
  }

  return appointments.filter((a) => isThisWeekInBogota(a.date));
}
