export type FollowupEntry = {
  actionId: string; source: "action" | "record"; type: string;
  petId: string; petName: string; petType: string;
  ownerId: string | null; ownerName: string | null; ownerPhone: string | null;
  conversationId: string | null; dueAt: string; notes: string | null;
  reminderSentAt: string | null; isOverdue: boolean; dayOffset?: number;
};
export type OpportunitiesData = {
  byType: Record<string, FollowupEntry[]>; total: number;
  page: number; totalPages: number; pageSize: number;
  periodCounts?: Record<"all" | "past" | "today" | "next7", number>;
};
export type InactiveClient = {
  id: string; phone: string; name: string | null;
  pets: { id?: string; name: string; type: string }[];
  lastVisitDate: string | null; lastReminderSentAt?: string | null;
};
export type InactiveClientsPage = { data: InactiveClient[]; total: number; page: number; totalPages: number; pageSize: number };
export function followupTiming(days: number | undefined) {
  if (days === undefined) return null;
  if (days === 0) return "Vence hoy";
  if (days > 0) return days === 1 ? "Dentro de 1 día" : `Dentro de ${days} días`;
  return days === -1 ? "Fecha pasada hace 1 día" : `Fecha pasada hace ${Math.abs(days)} días`;
}
export type ChurnClient = {
  id: string; name: string; phone: string; petName: string;
  lastVisitDays: number; avgIntervalDays: number; overdueRatio: number;
  riskLevel: "high" | "medium" | "low"; totalVisits: number;
};
export type RecoveryMetrics = {
  reactivation: { contacted: number; reactivated: number; rate: number };
  nextActions: { reminded: number; closed: number; rate: number };
};
export function contactPhoneValid(phone: string | null) {
  return typeof phone === "string" && /^\+?\d{8,15}$/.test(phone.replace(/\s/g, ""));
}
export function followupDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" }) : "Sin fecha";
}
