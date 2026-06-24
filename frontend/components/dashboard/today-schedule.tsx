"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VetRecordSheet } from "@/components/dashboard/vet-record-sheet";
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
import { useToast } from "@/components/ui/toast";

const VET_SERVICE_TYPES = ["vet", "consultation", "veterinary_consultation"];

function isVetAppointment(appt: TodayAppointment): boolean {
  return VET_SERVICE_TYPES.includes(appt.serviceType?.toLowerCase());
}

function canRecordVetAttention(appt: TodayAppointment): boolean {
  return (
    isVetAppointment(appt) &&
    (appt.status === "in_progress" || appt.status === "completed")
  );
}

function formatTimeSince(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 10) return "justo ahora";
  if (secs < 60) return `hace ${secs}s`;
  return `hace ${Math.floor(secs / 60)}min`;
}

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

const POLL_INTERVAL_MS = 30_000;

export function TodaySchedule({ appointments: initial }: Props) {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState(initial);
  const [updating, setUpdating] = useState<string | null>(null);
  const [recordingAppt, setRecordingAppt] = useState<TodayAppointment | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [polling, setPolling] = useState(false);
  const updatingRef = useRef<string | null>(null);

  const header = formatTodayHeader();
  const capitalized = header.charAt(0).toUpperCase() + header.slice(1);

  const refresh = useCallback(async (silent = true) => {
    // Don't poll while a status update is in flight
    if (updatingRef.current) return;
    if (!silent) setPolling(true);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/appointments/today"), {
        cache: "no-store",
      });
      if (res.ok) {
        const data: TodayAppointment[] = await res.json();
        setAppointments(data);
        setLastUpdated(new Date());
      }
    } catch { /* silently ignore network errors */ } finally {
      if (!silent) setPolling(false);
    }
  }, []);

  // Keep updatingRef in sync so the interval can check it
  useEffect(() => { updatingRef.current = updating; }, [updating]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => refresh(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function updateStatus(id: string, nextStatus: string) {
    if (nextStatus === "cancelled") {
      const confirmed = window.confirm("¿Cancelar esta cita? Esta acción no se puede deshacer.");
      if (!confirmed) return;
    }
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
      setAppointments(prev); // revierte el cambio optimista
      toast("No se pudo actualizar el estado de la cita.", "error");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <>
      <Card className="border-t-2 border-t-teal-500/50 border-white/[0.12]">
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/[0.06] pb-3">
          <CardTitle className="text-base font-semibold">Agenda de hoy</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{capitalized}</span>
            <button
              onClick={() => refresh(false)}
              disabled={polling}
              aria-label="Actualizar ahora"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-3.5 h-3.5 ${polling ? "animate-spin" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H5.498a.75.75 0 0 0-.75.75v3.232a.75.75 0 0 0 1.5 0v-1.54l.308.31a7 7 0 0 0 11.494-3.353.75.75 0 1 0-1.454-.364zm-4.306-9.85a.75.75 0 0 0-.75.75v3.232a.75.75 0 0 0 1.5 0v-1.54l.308.31a7 7 0 0 0-11.494 3.353.75.75 0 0 0 1.454.364 5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5h3.232a.75.75 0 0 0 .75-.75V2.324a.75.75 0 0 0-.75-.75z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden sm:inline">
                {polling ? "Actualizando…" : `${formatTimeSince(lastUpdated)}`}
              </span>
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 ring-1 ring-teal-500/20 text-2xl">🐾</div>
              <p className="mt-1 text-base font-medium">No hay citas para hoy</p>
              <p className="text-sm text-muted-foreground">El agente WhatsApp irá agendando durante el día.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {appointments.map((appt) => {
                const transitions = getStatusTransitions(appt.status);
                const busy = updating === appt.id;
                const showRecordBtn = canRecordVetAttention(appt);
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

                        {/* Acciones de estado + registro clínico */}
                        {(transitions.length > 0 || showRecordBtn) && (
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
                            {showRecordBtn && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 px-2.5 text-xs"
                                disabled={busy}
                                onClick={() => setRecordingAppt(appt)}
                              >
                                🩺 Registrar atención
                              </Button>
                            )}
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

      {recordingAppt && (
        <VetRecordSheet
          appointment={recordingAppt}
          open={recordingAppt !== null}
          onOpenChange={(open) => { if (!open) setRecordingAppt(null); }}
          onSaved={() => { /* badge stays; no state change needed */ }}
        />
      )}
    </>
  );
}
