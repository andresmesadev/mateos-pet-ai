import Link from "next/link";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EscalationsPanel } from "@/components/dashboard/escalations-panel";
import { TodaySchedule } from "@/components/dashboard/today-schedule";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import {
  type TodayAppointment,
  formatColombiaDateTime,
  formatService,
  formatStatus,
  statusBadgeClass,
} from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";

type UpcomingAppointment = TodayAppointment;

async function fetchToday(
  headers: Record<string, string>
): Promise<TodayAppointment[]> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/appointments/today"), {
      cache: "no-store",
      headers,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchUpcoming(
  headers: Record<string, string>
): Promise<UpcomingAppointment[]> {
  try {
    const res = await fetch(apiUrl("/api/dashboard/appointments/upcoming"), {
      cache: "no-store",
      headers,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchInactiveCount(
  headers: Record<string, string>
): Promise<number> {
  try {
    const res = await fetch(
      apiUrl("/api/dashboard/clients/inactive-count"),
      { cache: "no-store", headers }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

type DashboardPageProps = {
  searchParams: Promise<{ tenant?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { tenant } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);
  const [today, upcoming, inactiveCount] = await Promise.all([
    fetchToday(headers),
    fetchUpcoming(headers),
    fetchInactiveCount(headers),
  ]);

  return (
    <div className="space-y-8">
      {/* HOY */}
      <TodaySchedule appointments={today} />

      {/* ALERTAS */}
      <EscalationsPanel />

      {/* PRÓXIMAS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Próximas citas</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No hay citas programadas para los próximos 7 días.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {upcoming.map((appt) => (
                <li key={appt.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-base">{getPetEmoji(appt.petType)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{appt.petName}</span>
                    <span className="text-muted-foreground text-sm">
                      {" "}· {formatService(appt.serviceType)}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {formatColombiaDateTime(appt.date)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${statusBadgeClass(appt.status)}`}
                  >
                    {formatStatus(appt.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* REACTIVAR PREVIEW */}
      {inactiveCount > 0 && (
        <Link href="/dashboard/reactivation" className="block">
          <Card className="border-2 border-orange-200 bg-orange-50/50 transition-colors hover:bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/10 dark:hover:bg-orange-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                Clientes a reactivar
                <Badge className="border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300">
                  {inactiveCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {inactiveCount} cliente{inactiveCount === 1 ? "" : "s"} sin cita
                en más de 60 días. Envíales un WhatsApp para recuperarlos →
              </p>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
