import { BOGOTA_TIMEZONE } from "@/lib/appointments";
import { formatPhone, formatRelativeTime } from "@/lib/escalations";
import type { TeamRole } from "@/lib/dashboard-access";

export type ConversationAssignment = { actorId: string; name: string; role: TeamRole; since: string };

export type DashboardConversation = {
  id: string;
  userId: string;
  tenantId: string | null;
  name: string | null;
  status: string;
  assignment?: ConversationAssignment | null;
  controlVersion?: number;
  phone: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  step: string | null;
  requires_human_attention: boolean;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  role: string;
  origin?: string;
  senderKind?: "human" | "ai" | "system" | null;
  senderName?: string | null;
  senderRole?: TeamRole | null;
  content: string;
  createdAt: string;
};

export type ConversationDetail = {
  conversation: {
    id: string;
    userId: string;
    tenantId: string | null;
    status: string;
    assignment: ConversationAssignment | null;
    controlVersion: number;
    phone: string | null;
    name: string | null;
    step: string | null;
    requires_human_attention: boolean;
    updatedAt: string;
  };
  messages: ConversationMessage[];
  viewer: { role: TeamRole; isMine: boolean; canRelease: boolean; canTakeOver: boolean; canCreateAppointment: boolean };
};

export type ChatAppointment = { id: string; date: string; status: string; petId: string | null; petName: string; serviceName: string; category: string | null; professional: string | null };
export type ConversationContext = {
  client: { id: string; name: string | null; phone: string; phoneAlt: string | null; email: string | null; address: string | null; pets: { id: string; name: string; type: string; breed: string | null }[] };
  upcoming: ChatAppointment[]; active: ChatAppointment[]; lastVisit: ChatAppointment | null;
  permissions: { role: TeamRole; canViewClient: boolean; canViewClinical: boolean; canViewGrooming: boolean; canCreateAppointment: boolean };
};

export type ConversationsResponse = {
  data: DashboardConversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const STEP_LABELS: Record<string, string> = {
  // flujo de cita veterinaria
  awaiting_pet_name:              "Esperando nombre de la mascota",
  awaiting_pet_type:              "Esperando tipo de mascota",
  awaiting_date_time:             "Esperando fecha y hora",
  awaiting_confirmation:          "Esperando confirmación",
  completed:                      "Completada",
  // flujo de peluquería / grooming
  awaiting_grooming_slot_confirm: "Esperando confirmación de turno (peluquería)",
  awaiting_grooming_date:         "Esperando fecha de peluquería",
  awaiting_grooming_time:         "Esperando hora de peluquería",
  grooming_confirmed:             "Peluquería confirmada",
  // flujo general
  greeting:                       "Saludo inicial",
  idle:                           "Sin actividad",
  human_takeover:                 "Atención humana",
  escalated:                      "Escalado a humano",
  cancelled:                      "Cancelada",
};

export function formatConversationStep(step: string | null): string {
  if (!step) return "Sin paso activo";
  return STEP_LABELS[step] ?? step.replace(/_/g, " ");
}

export function formatColombiaTime(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export { formatPhone, formatRelativeTime };
