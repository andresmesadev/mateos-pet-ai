import { Calendar } from "lucide-react";

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

export default async function CalendarPage({ searchParams }: PageProps) {
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

  try {
    const res = await fetch(url.toString(), { cache: "no-store", headers });
    if (res.ok) data = await res.json();
  } catch { /* fallback to empty */ }

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Vista semanal de citas — hora Bogotá"
        icon={Calendar}
        tint="bg-teal-500/15 text-teal-400"
      />
      <WeekCalendar data={data} />
    </div>
  );
}
