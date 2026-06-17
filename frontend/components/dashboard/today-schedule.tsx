"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type TodayAppointment,
  formatColombiaTime,
  formatService,
  formatStatus,
  getStatusTransitions,
  statusBadgeClass,
} from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";
import { proxyUrl } from "@/lib/api";

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

export function TodaySchedule({ appointments: initial }: Props) {
  const [appointments, setAppointments] = useState(initial);
  const [updating, setUpdating] = useState<string | null>(null);

  const header = formatTodayHeader();
  const capitalized = header.charAt(0).toUpperCase() + header.slice(1);

  async function updateStatus(id: string, nextStatus: string) {
    setUpdating(id);
    const prev = appointments;
    setAppointments((all) =>
      all.map((a) => (a.id === id ? { ...a, status: nextStatus } : a))
    );
    try {
      const res = await fetch(proxyUrl(`/api/dashboard/appointments/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      const updated: TodayAppointment = await res.json();
      setAppointments((all) => all.map((a) => (a.id === id ? updated : a)));
    } catch {
      setAppointments(prev);
    } finally {
      setUpdating(null);
    }
  }

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
            {appointments.map((appt) => {
              const transitions = getStatusTransitions(appt.status);
              const busy = updating === appt.id;
              return (
                <li key={appt.id} className="py-3">
                  <div className="flex items-start gap-4">
                    {/* Hora */}
                    <div className="w-14 shrink-0 text-right pt-0.5">
                      <span className="text-lg font-bold tabular-nums leading-none">
                        {formatColombiaTime(appt.date)}
                      </span>
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-base">{getPetEmoji(appt.petType)}</span>
                        <span className="font-medium">{appt.petName}</span>
                        <span className="text-muted-foreground text-sm">·</span>
                        <span className="text-sm text-muted-foreground truncate">
                          {appt.clientName ?? appt.clientPhone}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                        <span>{appt.serviceName ?? formatService(appt.serviceType)}</span>
                        {appt.staffName && (
                          <>
                            <span>·</span>
                            <span>{appt.staffName}</span>
                          </>
                        )}
                        {appt.price !== null && (
                          <>
                            <span>·</span>
                            <span>
                              {new Intl.NumberFormat("es-CO", {
                                style: "currency",
                                currency: "COP",
                                maximumFractionDigits: 0,
                              }).format(appt.price)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Acciones de estado */}
                      {transitions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {transitions.map((t) => (
                            <Button
                              key={t.next}
                              size="sm"
                              variant={t.variant ?? "outline"}
                              className="h-7 px-2.5 text-xs"
                              disabled={busy}
                              onClick={() => updateStatus(appt.id, t.next)}
                            >
                              {t.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Badge de estado */}
                    <Badge
                      variant="outline"
                      className={`shrink-0 mt-0.5 ${statusBadgeClass(appt.status)}`}
                    >
                      {formatStatus(appt.status)}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
