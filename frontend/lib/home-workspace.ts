import type { DashboardAccess } from "./dashboard-access";
import type { TodayAppointment } from "./appointments";

export function homeHref(path: string, tenant?: string | null): string {
  const [pathname, query] = path.split("?");
  const params = new URLSearchParams(query);
  if (tenant) params.set("tenant", tenant);
  return pathname + (params.size ? `?${params}` : "");
}

export function homeSources(access: DashboardAccess, date: string) {
  const c = access.capabilities;
  return {
    profile: "/api/dashboard/tenant/profile",
    appointments: c.agenda ? "/api/dashboard/appointments/today" : null,
    clinical: c.clinical ? `/api/dashboard/appointments/week?date=${date}` : null,
    grooming: c.grooming ? `/api/dashboard/grooming/appointments?date=${date}` : null,
    conversations: c.chat ? "/api/dashboard/conversations?attention=human&limit=2" : null,
    cash: c.cash ? "/api/dashboard/cash/operational" : null,
    low: c.inventory_read ? "/api/dashboard/inventory/products?status=low&limit=1" : null,
    expired: c.inventory_read ? "/api/dashboard/inventory/products?status=expired&limit=1" : null,
    expiring: c.inventory_read ? "/api/dashboard/inventory/products?status=expiring&limit=1" : null,
    followups: c.administration && c.services ? "/api/dashboard/next-actions/upcoming?limit=6" : null,
    finances: c.finance ? `/api/dashboard/metrics/cashbox?date=${date}` : null,
  };
}

export function dayCounts(appointments: TodayAppointment[]) {
  return {
    scheduled: appointments.filter(a => ["pending", "confirmed"].includes(a.status)).length,
    waiting: appointments.filter(a => a.status === "arrived").length,
    inProgress: appointments.filter(a => a.status === "in_progress").length,
    completed: appointments.filter(a => a.status === "completed").length,
  };
}

export function homeAppointments(rows: TodayAppointment[], access: DashboardAccess) {
  return rows.filter(row => !["veterinary", "grooming"].includes(row.serviceCategory ?? "") || access.activeModules.includes(row.serviceCategory!));
}

export function clinicalPending(rows: TodayAppointment[], date: string, staffId?: string | null) {
  return rows.filter(a => a.serviceCategory ? a.serviceCategory === "veterinary" : ["vet", "consultation", "veterinary_consultation"].includes(a.serviceType))
    .filter(a => new Date(a.date).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) === date &&
      ["in_progress", "completed"].includes(a.status) && a.hasMedicalRecord === false && (!staffId || a.staffId === staffId));
}

export function financialDay(data: { transactions: { total: number }[]; expenses: { amount: number }[] }) {
  const income = data.transactions.reduce((sum, row) => sum + Math.round(row.total * 100), 0);
  const expenses = data.expenses.reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
  return { income: income / 100, expenses: expenses / 100, difference: (income - expenses) / 100 };
}

export function pendingLabel(count: number, partial = false) {
  return partial ? `${count} en lista` : String(count);
}

export type HomeTaskKind = "expired" | "chat" | "clinical" | "grooming" | "cash" | "low" | "expiring" | "followups";

const TASK_ORDER: Record<DashboardAccess["role"], HomeTaskKind[]> = {
  admin: ["expired", "chat", "clinical", "grooming", "cash", "low", "expiring", "followups"],
  receptionist: ["chat", "cash", "grooming", "clinical", "expired", "low", "expiring", "followups"],
  vet: ["clinical", "expired", "chat", "cash", "grooming", "low", "expiring", "followups"],
  groomer: ["grooming", "chat", "cash", "expired", "clinical", "low", "expiring", "followups"],
};

export function orderHomeTasks<T extends { kind: HomeTaskKind }>(tasks: T[], role: DashboardAccess["role"]): T[] {
  const order = TASK_ORDER[role];
  return [...tasks].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

export function homeHasMissingSources(paths: Record<string, string | null>, results: Record<string, unknown>): boolean {
  return Object.entries(paths).some(([key, path]) => path !== null && results[key] == null);
}
