"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type TodayAppointment,
  formatColombiaTime,
  formatService,
  formatStatus,
  statusBadgeClass,
} from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";

function formatTodayHeader(): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

type Props = {
  appointments: TodayAppointment[];
};

export function TodaySchedule({ appointments }: Props) {
  const header = formatTodayHeader();
  const capitalized = header.charAt(0).toUpperCase() + header.slice(1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Agenda de hoy</CardTitle>
        <span className="text-sm text-muted-foreground">{capitalized}</span>
      </CardHeader>

      <CardContent>
        {appointments.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center">
            <p className="text-lg font-medium">No hay citas para hoy 🐾</p>
            <p className="mt-1 text-sm text-muted-foreground">
              El agente WhatsApp irá agendando durante el día.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {appointments.map((appt) => (
              <li key={appt.id} className="flex items-start gap-4 py-3">
                <div className="w-14 shrink-0 text-right">
                  <span className="text-lg font-bold tabular-nums leading-none">
                    {formatColombiaTime(appt.date)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-base">
                      {getPetEmoji(appt.petType)}
                    </span>
                    <span className="font-medium">{appt.petName}</span>
                    <span className="text-muted-foreground text-sm">·</span>
                    <span className="text-sm text-muted-foreground truncate">
                      {appt.clientName ?? appt.clientPhone}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatService(appt.serviceType)}
                  </p>
                </div>

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
  );
}
