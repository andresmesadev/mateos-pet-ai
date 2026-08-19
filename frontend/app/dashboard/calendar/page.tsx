import { Calendar } from "lucide-react";
import { connection } from "next/server";

import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { WeekCalendar } from "@/components/dashboard/week-calendar";
import { type TodayAppointment } from "@/lib/appointments";

type WeekData = {
  weekStart: string;
  weekEnd: string;
  mondayYmd: string;
  appointments: TodayAppointment[];
};

type PageProps = {
  searchParams: Promise<{ date?: string; tenant?: string }>;
};

type BusinessHours = Record<string, { open: string; close: string; active: boolean }>;

function parseHour(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

function resolveRange(bh: BusinessHours | null): { hourStart: number; hourEnd: number } {
  if (!bh) return { hourStart: 7, hourEnd: 20 };
  const active = Object.values(bh).filter((d) => d.active);
  if (!active.length) return { hourStart: 7, hourEnd: 20 };
  const opens = active.map((d) => parseHour(d.open));
  const closes = active.map((d) => parseHour(d.close));
  return {
    hourStart: Math.floor(Math.min(...opens)),
    hourEnd: Math.ceil(Math.max(...closes)),
  };
}

export default async function CalendarPage({ searchParams }: PageProps) {
  await connection();
  const { date, tenant } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  const url = new URL(apiUrl("/api/dashboard/appointments/week"));
  if (date) url.searchParams.set("date", date);

  let data: WeekData = {
    weekStart: new Date().toISOString(),
    weekEnd: new Date().toISOString(),
    mondayYmd: new Date().toISOString().slice(0, 10),
    appointments: [],
  };

  let businessHours: BusinessHours | null = null;

  try {
    const [apptRes, profileRes] = await Promise.all([
      fetch(url.toString(), { cache: "no-store", headers }),
      fetch(apiUrl("/api/dashboard/tenant/profile"), { cache: "no-store", headers }),
    ]);
    if (apptRes.ok) data = await apptRes.json();
    if (profileRes.ok) {
      const profile = await profileRes.json();
      businessHours = profile.businessHours ?? null;
    }
  } catch { /* fallback to defaults */ }

  const { hourStart, hourEnd } = resolveRange(businessHours);

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Vista semanal de citas — hora Bogotá"
        icon={Calendar}
        tint="bg-teal-500/15 text-teal-400"
      />
      <WeekCalendar data={data} hourStart={hourStart} hourEnd={hourEnd} />
    </div>
  );
}
