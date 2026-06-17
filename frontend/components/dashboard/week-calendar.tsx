"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type TodayAppointment,
  statusBadgeClass,
  formatStatus,
} from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";

// ── Constants ─────────────────────────────────────────────────

const HOUR_START = 7;   // 7 am
const HOUR_END   = 20;  // 8 pm (exclusive)
const SLOT_HEIGHT = 56; // px per hour

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

// ── Helpers ───────────────────────────────────────────────────

// Shift a UTC instant by -5h so getUTC* methods return Bogotá local values
function toBogotaUTC(iso: string): Date {
  const ms = new Date(iso).getTime();
  return new Date(ms - 5 * 3_600_000);
}

function ymdFromIso(iso: string): string {
  const b = toBogotaUTC(iso);
  const y = b.getUTCFullYear();
  const m = String(b.getUTCMonth() + 1).padStart(2, "0");
  const d = String(b.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function prevMonday(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

function nextMonday(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function weekLabel(mondayYmd: string): string {
  const mon = new Date(`${mondayYmd}T12:00:00Z`);
  const sun = new Date(mon.getTime() + 6 * 86_400_000);
  const monD = mon.getUTCDate();
  const sunD = sun.getUTCDate();
  const monM = MONTH_NAMES[mon.getUTCMonth()];
  const sunM = MONTH_NAMES[sun.getUTCMonth()];
  if (mon.getUTCMonth() === sun.getUTCMonth()) {
    return `${monD}–${sunD} de ${monM} ${sun.getUTCFullYear()}`;
  }
  return `${monD} ${monM} – ${sunD} ${sunM} ${sun.getUTCFullYear()}`;
}

function todayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 10);
}

// ── Appointment block ─────────────────────────────────────────

const STATUS_BG: Record<string, string> = {
  pending:    "bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600",
  confirmed:  "bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700",
  arrived:    "bg-cyan-50 border-cyan-300 dark:bg-cyan-950 dark:border-cyan-700",
  in_progress:"bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700",
  completed:  "bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700",
  cancelled:  "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900 opacity-50",
  no_show:    "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900 opacity-50",
};

function ApptBlock({
  appt,
  topPx,
  heightPx,
  onClick,
}: {
  appt: TodayAppointment;
  topPx: number;
  heightPx: number;
  onClick: () => void;
}) {
  const bg = STATUS_BG[appt.status] ?? STATUS_BG.pending;
  return (
    <button
      onClick={onClick}
      style={{ top: topPx, height: Math.max(heightPx, 28) }}
      className={`absolute left-0.5 right-0.5 overflow-hidden rounded border px-1 py-0.5 text-left text-xs ${bg} hover:ring-1 hover:ring-ring transition-shadow`}
    >
      <span className="font-medium leading-tight line-clamp-1">
        {getPetEmoji(appt.petType)} {appt.petName}
      </span>
      {heightPx >= 44 && (
        <span className="block text-muted-foreground leading-tight line-clamp-1">
          {appt.serviceName ?? appt.serviceType}
        </span>
      )}
    </button>
  );
}

// ── Detail popover ────────────────────────────────────────────

function ApptDetail({
  appt,
  onClose,
}: {
  appt: TodayAppointment;
  onClose: () => void;
}) {
  const timeStr = new Date(appt.date).toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-semibold text-base">
              {getPetEmoji(appt.petType)} {appt.petName}
            </p>
            <p className="text-sm text-muted-foreground">{appt.clientName ?? appt.clientPhone}</p>
          </div>
          <Badge variant="outline" className={`shrink-0 text-xs ${statusBadgeClass(appt.status)}`}>
            {formatStatus(appt.status)}
          </Badge>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2"><dt className="text-muted-foreground w-20 shrink-0">Hora</dt><dd>{timeStr}</dd></div>
          <div className="flex gap-2"><dt className="text-muted-foreground w-20 shrink-0">Servicio</dt><dd>{appt.serviceName ?? appt.serviceType}</dd></div>
          {appt.staffName && <div className="flex gap-2"><dt className="text-muted-foreground w-20 shrink-0">Staff</dt><dd>{appt.staffName}</dd></div>}
          {appt.price != null && <div className="flex gap-2"><dt className="text-muted-foreground w-20 shrink-0">Precio</dt><dd>${appt.price.toLocaleString("es-CO")}</dd></div>}
        </dl>
        <Button size="sm" variant="outline" className="mt-4 w-full" onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

type WeekData = {
  weekStart: string;
  mondayYmd: string;
  appointments: TodayAppointment[];
};

export function WeekCalendar({ data }: { data: WeekData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<TodayAppointment | null>(null);

  const { mondayYmd, appointments } = data;
  const today = todayYmd();

  // Build 7 day columns
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${mondayYmd}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  // Group appointments by day
  const byDay: Record<string, TodayAppointment[]> = {};
  for (const ymd of days) byDay[ymd] = [];
  for (const appt of appointments) {
    const ymd = ymdFromIso(appt.date);
    if (byDay[ymd]) byDay[ymd].push(appt);
  }

  // Hours array
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const gridHeight = hours.length * SLOT_HEIGHT;

  function navigate(ymd: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", ymd);
    router.push(`/dashboard/calendar?${params.toString()}`);
  }

  function apptPosition(appt: TodayAppointment): { top: number; height: number } {
    const b = toBogotaUTC(appt.date);
    const hour = b.getUTCHours() + b.getUTCMinutes() / 60;
    const top = (hour - HOUR_START) * SLOT_HEIGHT;
    const height = SLOT_HEIGHT * 0.85;
    return { top: isNaN(top) ? 0 : top, height };
  }

  return (
    <>
      {selected && <ApptDetail appt={selected} onClose={() => setSelected(null)} />}

      {/* Header: navigation */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => navigate(prevMonday(mondayYmd))}>← Semana anterior</Button>
        <span className="font-medium text-sm flex-1 text-center min-w-32">{weekLabel(mondayYmd)}</span>
        <Button size="sm" variant="outline" onClick={() => navigate(today)}>Hoy</Button>
        <Button size="sm" variant="outline" onClick={() => navigate(nextMonday(mondayYmd))}>Semana siguiente →</Button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-xl border bg-background">
        <div className="min-w-[640px]">
          {/* Day headers */}
          <div className="grid border-b" style={{ gridTemplateColumns: "3rem repeat(7, 1fr)" }}>
            <div className="border-r" />
            {days.map((ymd, i) => {
              const d = new Date(`${ymd}T12:00:00Z`);
              const isToday = ymd === today;
              return (
                <div
                  key={ymd}
                  className={`border-r last:border-r-0 py-2 text-center text-xs font-medium ${isToday ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-muted-foreground"}`}
                >
                  <div>{DAY_NAMES[i]}</div>
                  <div className={`text-base font-bold ${isToday ? "" : "text-foreground"}`}>
                    {d.getUTCDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="relative grid" style={{ gridTemplateColumns: "3rem repeat(7, 1fr)", height: gridHeight }}>
            {/* Hour labels + horizontal lines */}
            {hours.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-border/50"
                style={{ top: (h - HOUR_START) * SLOT_HEIGHT }}
              >
                <span className="absolute -top-2.5 left-1 text-[10px] text-muted-foreground w-10 text-right pr-1">
                  {h}:00
                </span>
              </div>
            ))}

            {/* Day columns */}
            {days.map((ymd, i) => {
              const isToday = ymd === today;
              const appts = byDay[ymd] ?? [];
              return (
                <div
                  key={ymd}
                  className={`relative border-r last:border-r-0 ${isToday ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}`}
                  style={{ gridColumn: i + 2 }}
                >
                  {appts.map((appt) => {
                    const { top, height } = apptPosition(appt);
                    if (top < 0 || top > gridHeight) return null;
                    return (
                      <ApptBlock
                        key={appt.id}
                        appt={appt}
                        topPx={top}
                        heightPx={height}
                        onClick={() => setSelected(appt)}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* Empty left gutter column */}
            <div className="border-r" style={{ gridColumn: 1, gridRow: 1 }} />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(["pending","confirmed","arrived","in_progress","completed","no_show"] as const).map((status) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded border ${STATUS_BG[status]}`} />
            {formatStatus(status)}
          </span>
        ))}
      </div>
    </>
  );
}
