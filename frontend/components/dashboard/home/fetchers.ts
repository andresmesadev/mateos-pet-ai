// Server-only: estos fetchers usan headers internos (X-Internal-Token) y solo
// deben importarse desde Server Components (sections.tsx). No añadir "use client".
import { apiUrl } from "@/lib/api";
import { type TodayAppointment } from "@/lib/appointments";

export type UpcomingAppointment = TodayAppointment;

export type MetricsData = {
  appointmentsThisWeek: { count: number; prev: number; delta: number };
  confirmationRate: { rate: number; prev: number; delta: number };
  newClientsThisMonth: { count: number; prev: number; delta: number };
};

export type ActionsSummary = {
  total: number;
  byType: Record<string, number>;
  overduePets: number;
};

export type RecoveryMetrics = {
  reactivation: { contacted: number; reactivated: number; rate: number };
  nextActions: { reminded: number; closed: number; rate: number };
};

export type ChurnPreview = { name: string; riskLevel: string };

export const METRICS_FALLBACK: MetricsData = {
  appointmentsThisWeek: { count: 0, prev: 0, delta: 0 },
  confirmationRate: { rate: 0, prev: 0, delta: 0 },
  newClientsThisMonth: { count: 0, prev: 0, delta: 0 },
};

export const ACTIONS_FALLBACK: ActionsSummary = { total: 0, byType: {}, overduePets: 0 };

export const RECOVERY_FALLBACK: RecoveryMetrics = {
  reactivation: { contacted: 0, reactivated: 0, rate: 0 },
  nextActions: { reminded: 0, closed: 0, rate: 0 },
};

type Headers = Record<string, string>;

export async function fetchToday(headers: Headers): Promise<TodayAppointment[]> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/appointments/today"), { cache: "no-store", headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export async function fetchUpcoming(headers: Headers): Promise<UpcomingAppointment[]> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/appointments/upcoming"), { cache: "no-store", headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export async function fetchInactiveCount(headers: Headers): Promise<number> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/clients/inactive-count"), { cache: "no-store", headers });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch { return 0; }
}

export async function fetchMetrics(headers: Headers): Promise<MetricsData> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/metrics"), { cache: "no-store", headers });
    if (!res.ok) return METRICS_FALLBACK;
    return (await res.json()) as MetricsData;
  } catch { return METRICS_FALLBACK; }
}

export async function fetchActionsSummary(headers: Headers): Promise<ActionsSummary> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/next-actions/summary"), { cache: "no-store", headers });
    if (!res.ok) return ACTIONS_FALLBACK;
    return (await res.json()) as ActionsSummary;
  } catch { return ACTIONS_FALLBACK; }
}

export async function fetchRecoveryMetrics(headers: Headers): Promise<RecoveryMetrics> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/metrics/recovery"), { cache: "no-store", headers });
    if (!res.ok) return RECOVERY_FALLBACK;
    return (await res.json()) as RecoveryMetrics;
  } catch { return RECOVERY_FALLBACK; }
}

export async function fetchChurnPreview(headers: Headers): Promise<ChurnPreview[]> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/metrics/churn?limit=5"), { cache: "no-store", headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
