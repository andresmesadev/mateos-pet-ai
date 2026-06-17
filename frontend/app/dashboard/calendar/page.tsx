import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calendario</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista semanal de citas — hora Bogotá.
        </p>
      </div>
      <WeekCalendar data={data} />
    </div>
  );
}
