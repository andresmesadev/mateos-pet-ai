import { BOGOTA_TIMEZONE } from "@/lib/appointments";
import { formatPhone, formatRelativeTime } from "@/lib/escalations";

export type DashboardConversation = {
  id: string;
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
  content: string;
  createdAt: string;
};

export type ConversationDetail = {
  conversation: {
    id: string;
    phone: string | null;
    step: string | null;
    requires_human_attention: boolean;
    updatedAt: string;
  };
  messages: ConversationMessage[];
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
  awaiting_pet_name: "Esperando nombre",
  awaiting_pet_type: "Esperando tipo",
  awaiting_date_time: "Esperando fecha",
  awaiting_confirmation: "Esperando confirmación",
  completed: "Completada",
};

export function formatConversationStep(step: string | null): string {
  if (!step) {
    return "Sin paso activo";
  }

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
