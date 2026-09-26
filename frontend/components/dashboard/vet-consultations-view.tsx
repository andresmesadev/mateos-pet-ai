"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, Clock3, Stethoscope } from "lucide-react";

import { VetRecordSheet } from "@/components/dashboard/vet-record-sheet";
import { type TodayAppointment, formatStatus, statusBadgeClass } from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";

type Props = {
  appointments: TodayAppointment[];
  preview?: boolean;
};

const VET_SERVICE_TYPES = new Set(["vet", "consultation", "veterinary_consultation"]);

function isVetAppointment(appointment: TodayAppointment): boolean {
  const serviceType = appointment.serviceType.toLowerCase();
  return VET_SERVICE_TYPES.has(serviceType) || /consulta|veterinar|vacuna/.test(appointment.serviceName?.toLowerCase() ?? "");
}

function bogotaDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function appointmentDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function appointmentTime(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function VetConsultationsView({ appointments, preview = false }: Props) {
  const [scope, setScope] = useState<"today" | "week">("today");
  const [selected, setSelected] = useState<TodayAppointment | null>(null);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const veterinaryAppointments = appointments
    .filter(isVetAppointment)
    .filter((appointment) => appointment.status !== "cancelled" && appointment.status !== "no_show")
    .sort((a, b) => a.date.localeCompare(b.date));
  const visible = scope === "today"
    ? veterinaryAppointments.filter((appointment) => bogotaDate(appointment.date) === today)
    : veterinaryAppointments;
  const inProgress = veterinaryAppointments.filter((appointment) => appointment.status === "in_progress").length;
  const completed = veterinaryAppointments.filter((appointment) => appointment.status === "completed").length;
  const scheduled = veterinaryAppointments.length - inProgress - completed;

  const metrics = [
    { label: "Por atender", value: scheduled, icon: CalendarDays, tint: "bg-sky-50 text-sky-700" },
    { label: "En atención", value: inProgress, icon: Stethoscope, tint: "bg-amber-50 text-amber-700" },
    { label: "Atendidas", value: completed, icon: ClipboardList, tint: "bg-teal-50 text-teal-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon, tint }) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label} esta semana</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <section aria-labelledby="consultas-lista" className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 id="consultas-lista" className="text-lg font-bold text-foreground">Citas veterinarias</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">La atención clínica se registra desde una cita en curso o completada.</p>
          </div>
          <div aria-label="Período de consultas" className="inline-flex rounded-lg border border-border p-1">
            {(["today", "week"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setScope(option)}
                aria-pressed={scope === option}
                className={`min-h-9 rounded-md px-4 text-sm font-semibold transition-colors ${scope === option ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {option === "today" ? "Hoy" : "Esta semana"}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Stethoscope className="h-6 w-6" aria-hidden="true" /></span>
            <h3 className="mt-4 font-semibold">{scope === "today" ? "No hay consultas veterinarias hoy" : "No hay consultas veterinarias esta semana"}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Las citas veterinarias aparecerán aquí cuando estén registradas en la agenda.</p>
            {scope === "today" && veterinaryAppointments.length > 0 && (
              <button type="button" onClick={() => setScope("week")} className="mt-4 text-sm font-semibold text-teal-700 hover:underline">Ver esta semana</button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((appointment) => {
              const canRecord = Boolean(appointment.petId) && ["in_progress", "completed"].includes(appointment.status);
              const date = bogotaDate(appointment.date);
              const calendarParams = new URLSearchParams({ date });
              if (preview) calendarParams.set("preview", "1");

              return (
                <li key={appointment.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl" aria-hidden="true">{getPetEmoji(appointment.petType)}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{appointment.petName}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(appointment.status)}`}>{formatStatus(appointment.status)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{appointment.clientName || appointment.clientPhone || "Cliente sin nombre"} · {appointment.serviceName ?? "Consulta veterinaria"}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{appointmentDate(appointment.date)} · {appointmentTime(appointment.date)}{appointment.staffName ? ` · ${appointment.staffName}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[60px] sm:pl-0">
                    {appointment.petId && !preview && (
                      <Link href={`/dashboard/contacto?pet=${encodeURIComponent(appointment.petId)}`} className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted">Ver historia</Link>
                    )}
                    {canRecord ? (
                      <button type="button" onClick={() => setSelected(appointment)} className="inline-flex min-h-9 items-center rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800">
                        {preview ? "Explorar formulario" : "Registrar atención"}
                      </button>
                    ) : (
                      <Link href={`/dashboard/calendar?${calendarParams.toString()}`} className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted">Ver en agenda</Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected && (
        <VetRecordSheet
          appointment={selected}
          open
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          preview={preview}
        />
      )}
    </div>
  );
}
