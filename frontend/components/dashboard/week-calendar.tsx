"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type TodayAppointment,
  statusBadgeClass,
  formatStatus,
} from "@/lib/appointments";
import { getPetEmoji } from "@/lib/pets";

// ── Constants ─────────────────────────────────────────────────

const SLOT_H = 60; // px per hour
const DAY_NAMES_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_NAMES_FULL  = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONTH_NAMES_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

type ViewMode = "month" | "week" | "day" | "scheduler";
type ClockMode = "24h" | "12h";

function fmtHour(h: number, clock: ClockMode): string {
  if (clock === "24h") return `${String(h).padStart(2, "0")}:00`;
  if (h === 0) return "12:00 am";
  if (h === 12) return "12:00 pm";
  return h < 12 ? `${h}:00 am` : `${h - 12}:00 pm`;
}

// ── Status colours ────────────────────────────────────────────

const STATUS_BG: Record<string, string> = {
  pending:     "bg-slate-100 border-l-slate-400 dark:bg-slate-800 dark:border-l-slate-500",
  confirmed:   "bg-blue-50 border-l-blue-400 dark:bg-blue-950 dark:border-l-blue-500",
  arrived:     "bg-cyan-50 border-l-cyan-400 dark:bg-cyan-950 dark:border-l-cyan-500",
  in_progress: "bg-amber-50 border-l-amber-400 dark:bg-amber-950 dark:border-l-amber-500",
  completed:   "bg-green-50 border-l-green-400 dark:bg-green-950 dark:border-l-green-500",
  cancelled:   "bg-red-50 border-l-red-300 dark:bg-red-950 dark:border-l-red-800 opacity-50",
  no_show:     "bg-red-50 border-l-red-300 dark:bg-red-950 dark:border-l-red-800 opacity-50",
};

const STATUS_DOT: Record<string, string> = {
  pending:     "bg-slate-400",
  confirmed:   "bg-blue-500",
  arrived:     "bg-cyan-500",
  in_progress: "bg-amber-500",
  completed:   "bg-green-500",
  cancelled:   "bg-red-400",
  no_show:     "bg-red-400",
};

// ── Date helpers ──────────────────────────────────────────────

function toBogota(iso: string): Date {
  return new Date(new Date(iso).getTime() - 5 * 3_600_000);
}

function ymdOf(iso: string): string {
  const b = toBogota(iso);
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth()+1).padStart(2,"0")}-${String(b.getUTCDate()).padStart(2,"0")}`;
}

function todayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function parseTimeToFrac(iso: string): number {
  const b = toBogota(iso);
  return b.getUTCHours() + b.getUTCMinutes() / 60;
}

// ── Appointment block (time-grid) ─────────────────────────────

function ApptBlock({ appt, topPx, heightPx, onClick }: {
  appt: TodayAppointment; topPx: number; heightPx: number; onClick: () => void;
}) {
  const bg = STATUS_BG[appt.status] ?? STATUS_BG.pending;
  return (
    <button
      onClick={onClick}
      style={{ top: topPx, height: Math.max(heightPx, 32) }}
      className={`absolute inset-x-0.5 overflow-hidden rounded border-l-4 bg-background px-2 py-1 text-left text-xs ${bg} hover:shadow-md transition-shadow`}
    >
      <span className="block font-semibold leading-tight truncate">
        {getPetEmoji(appt.petType)} {appt.petName}
      </span>
      {heightPx >= 48 && (
        <span className="block text-muted-foreground truncate leading-tight">
          {appt.clientName ?? appt.clientPhone}
        </span>
      )}
      {heightPx >= 64 && (
        <span className="block text-muted-foreground truncate leading-tight">
          {appt.serviceName ?? appt.serviceType}
        </span>
      )}
    </button>
  );
}

// ── Detail modal ──────────────────────────────────────────────

function ApptDetail({ appt, onClose }: { appt: TodayAppointment; onClose: () => void }) {
  const time = new Date(appt.date).toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit",
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <p className="text-lg font-bold">{getPetEmoji(appt.petType)} {appt.petName}</p>
            <p className="text-sm text-muted-foreground">{appt.clientName ?? appt.clientPhone}</p>
          </div>
          <Badge variant="outline" className={`shrink-0 text-xs ${statusBadgeClass(appt.status)}`}>
            {formatStatus(appt.status)}
          </Badge>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Hora</dt><dd className="font-medium">{time}</dd></div>
          <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Servicio</dt><dd className="font-medium">{appt.serviceName ?? appt.serviceType}</dd></div>
          {appt.staffName && <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Profesional</dt><dd className="font-medium">{appt.staffName}</dd></div>}
          {appt.finalPrice != null && <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">Precio</dt><dd className="font-medium">${appt.finalPrice.toLocaleString("es-CO")}</dd></div>}
        </dl>
        <Button size="sm" variant="outline" className="mt-5 w-full" onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

// ── Time grid (shared by Day, Week, Scheduler) ────────────────

function TimeGrid({
  hourStart, hourEnd, columns, apptsByCol, onSelect, clock = "24h",
}: {
  hourStart: number;
  hourEnd: number;
  columns: { id: string; label: string; sublabel?: string; isHighlight?: boolean }[];
  apptsByCol: Record<string, TodayAppointment[]>;
  onSelect: (a: TodayAppointment) => void;
  clock?: ClockMode;
}) {
  // Each entry = one hour slot; last line is the container bottom border
  const hours = Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i);
  const gridH = hours.length * SLOT_H;

  function pos(appt: TodayAppointment) {
    const frac = parseTimeToFrac(appt.date);
    const top = (frac - hourStart) * SLOT_H + 12; // +12 matches the pt-3 offset
    return { top: isNaN(top) ? 12 : top, height: SLOT_H * 0.9 };
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <div style={{ minWidth: Math.max(480, columns.length * 120 + 48) }}>
        {/* Column headers */}
        <div className="grid border-b sticky top-0 bg-background z-10" style={{ gridTemplateColumns: `3rem repeat(${columns.length}, 1fr)` }}>
          <div className="border-r" />
          {columns.map((col) => (
            <div key={col.id} className={`border-r last:border-r-0 py-3 px-2 text-center ${col.isHighlight ? "bg-primary/10 border-b-2 border-b-primary/50" : "border-b border-b-border"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${col.isHighlight ? "text-primary" : "text-muted-foreground"}`}>{col.label}</p>
              {col.sublabel && (
                <p className={`text-2xl font-bold mt-0.5 leading-tight ${col.isHighlight ? "text-primary" : ""}`}>
                  {col.isHighlight
                    ? <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">{col.sublabel}</span>
                    : col.sublabel}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Time grid — extra top padding so first label isn't clipped */}
        <div className="relative grid pt-3" style={{ gridTemplateColumns: `3rem repeat(${columns.length}, 1fr)`, height: gridH + 12 }}>
          {/* Hour lines + labels (one per slot, label centered in slot) */}
          {hours.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-border/40 pointer-events-none"
              style={{ top: (h - hourStart) * SLOT_H + 12 }}
            >
              <span
                className="absolute left-0 w-14 pr-2 text-right text-[10px] text-muted-foreground"
                style={{ top: SLOT_H / 2 - 6 }}
              >
                {fmtHour(h, clock)}
              </span>
            </div>
          ))}

          {/* Gutter */}
          <div className="border-r" style={{ gridColumn: 1 }} />

          {/* Day/Staff columns */}
          {columns.map((col, i) => {
            const appts = apptsByCol[col.id] ?? [];
            return (
              <div
                key={col.id}
                className={`relative border-r last:border-r-0 ${col.isHighlight ? "bg-primary/[0.06]" : ""}`}
                style={{ gridColumn: i + 2 }}
              >
                {appts.map((appt) => {
                  const { top, height } = pos(appt);
                  if (top < 0 || top > gridH) return null;
                  return (
                    <ApptBlock key={appt.id} appt={appt} topPx={top} heightPx={height} onClick={() => onSelect(appt)} />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Month view ────────────────────────────────────────────────

function MonthView({
  year, month, appointments, today,
  onDayClick,
}: {
  year: number; month: number; appointments: TodayAppointment[];
  today: string; onDayClick: (ymd: string) => void;
}) {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const firstDow = (firstDay.getUTCDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

  // Group appointments by day
  const byDay: Record<string, TodayAppointment[]> = {};
  for (const appt of appointments) {
    const ymd = ymdOf(appt.date);
    byDay[ymd] = [...(byDay[ymd] ?? []), appt];
  }

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const day = i - firstDow + 1;
    if (day < 1 || day > daysInMonth) return null;
    const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, ymd, appts: byDay[ymd] ?? [] };
  });

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      {/* Day header */}
      <div className="grid grid-cols-7 border-b">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="min-h-[90px] border-b border-r last:border-r-0 bg-muted/20" />;
          const isToday = cell.ymd === today;
          return (
            <button
              key={cell.ymd}
              onClick={() => onDayClick(cell.ymd)}
              className={`min-h-[90px] border-b border-r last:border-r-0 p-1.5 text-left hover:bg-muted/40 transition-colors ${isToday ? "bg-primary/5" : ""}`}
            >
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                {cell.day}
              </span>
              <div className="mt-1 space-y-0.5">
                {cell.appts.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center gap-1 rounded px-1 py-0.5 bg-muted/60">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[a.status] ?? "bg-slate-400"}`} />
                    <span className="text-[10px] truncate leading-tight">{getPetEmoji(a.petType)} {a.petName}</span>
                  </div>
                ))}
                {cell.appts.length > 3 && (
                  <p className="text-[10px] text-muted-foreground pl-1">+{cell.appts.length - 3} más</p>
                )}
              </div>
            </button>
          );
        })}
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

export function WeekCalendar({
  data,
  hourStart = 8,
  hourEnd = 18,
}: {
  data: WeekData;
  hourStart?: number;
  hourEnd?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewMode>("week");
  const [clock, setClock] = useState<ClockMode>("12h");
  const [selected, setSelected] = useState<TodayAppointment | null>(null);

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(interval);
  }, [router]);

  const { mondayYmd, appointments } = data;
  const today = todayYmd();

  // Current day for Day/Scheduler view — default to today if within week, else monday
  const [currentDay, setCurrentDay] = useState<string>(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(mondayYmd, i));
    return days.includes(today) ? today : mondayYmd;
  });

  // Current month for Month view
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date(`${mondayYmd}T12:00:00Z`);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });

  function navigate(ymd: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", ymd);
    router.push(`/dashboard/calendar?${params.toString()}`);
  }

  // Week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(mondayYmd, i));

  // Group by day
  const byDay: Record<string, TodayAppointment[]> = {};
  for (const ymd of weekDays) byDay[ymd] = [];
  for (const a of appointments) {
    const ymd = ymdOf(a.date);
    if (byDay[ymd]) byDay[ymd].push(a);
  }

  // Scheduler: group by staff
  const staffSet = new Map<string, string>(); // id → name
  for (const a of appointments) {
    const key = a.staffName ?? "Sin asignar";
    staffSet.set(key, key);
  }
  const staffCols = ["Sin asignar", ...Array.from(staffSet.keys()).filter((k) => k !== "Sin asignar")];

  const byStaff: Record<string, TodayAppointment[]> = {};
  for (const col of staffCols) byStaff[col] = [];
  for (const a of appointments) {
    if (ymdOf(a.date) !== currentDay) continue;
    const key = a.staffName ?? "Sin asignar";
    byStaff[key]?.push(a);
  }

  // Week label
  const mon = new Date(`${mondayYmd}T12:00:00Z`);
  const sun = new Date(`${addDays(mondayYmd, 6)}T12:00:00Z`);
  const weekLabel =
    mon.getUTCMonth() === sun.getUTCMonth()
      ? `${mon.getUTCDate()}–${sun.getUTCDate()} de ${MONTH_NAMES[mon.getUTCMonth()]} ${sun.getUTCFullYear()}`
      : `${mon.getUTCDate()} ${MONTH_NAMES_SHORT[mon.getUTCMonth()]} – ${sun.getUTCDate()} ${MONTH_NAMES_SHORT[sun.getUTCMonth()]} ${sun.getUTCFullYear()}`;

  // Day label
  const dayD = new Date(`${currentDay}T12:00:00Z`);
  const dayLabel = `${DAY_NAMES_FULL[(dayD.getUTCDay() + 6) % 7]} ${dayD.getUTCDate()} de ${MONTH_NAMES[dayD.getUTCMonth()]} ${dayD.getUTCFullYear()}`;

  // Month label
  const monthLabel = `${MONTH_NAMES[monthDate.month]} ${monthDate.year}`;

  function prevPeriod() {
    if (view === "month") {
      const m = monthDate.month === 0 ? 11 : monthDate.month - 1;
      const y = monthDate.month === 0 ? monthDate.year - 1 : monthDate.year;
      setMonthDate({ year: y, month: m });
    } else if (view === "day" || view === "scheduler") {
      const prev = addDays(currentDay, -1);
      setCurrentDay(prev);
      navigate(mondayOf(prev));
    } else {
      navigate(addDays(mondayYmd, -7));
    }
  }

  function nextPeriod() {
    if (view === "month") {
      const m = monthDate.month === 11 ? 0 : monthDate.month + 1;
      const y = monthDate.month === 11 ? monthDate.year + 1 : monthDate.year;
      setMonthDate({ year: y, month: m });
    } else if (view === "day" || view === "scheduler") {
      const next = addDays(currentDay, 1);
      setCurrentDay(next);
      navigate(mondayOf(next));
    } else {
      navigate(addDays(mondayYmd, 7));
    }
  }

  function goToday() {
    setCurrentDay(today);
    setMonthDate(() => {
      const d = new Date();
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    navigate(mondayOf(today));
  }

  const periodLabel = view === "month" ? monthLabel : view === "week" ? weekLabel : dayLabel;

  // Week columns for TimeGrid
  const weekColumns = weekDays.map((ymd, i) => {
    const d = new Date(`${ymd}T12:00:00Z`);
    return {
      id: ymd,
      label: DAY_NAMES_SHORT[i],
      sublabel: String(d.getUTCDate()),
      isHighlight: ymd === today,
    };
  });

  // Day column for TimeGrid
  const dayColumns = [{
    id: currentDay,
    label: DAY_NAMES_FULL[(dayD.getUTCDay() + 6) % 7],
    sublabel: String(dayD.getUTCDate()),
    isHighlight: currentDay === today,
  }];

  // Scheduler columns
  const schedulerColumns = staffCols.map((name) => ({
    id: name,
    label: name,
    isHighlight: false,
  }));

  return (
    <>
      {selected && <ApptDetail appt={selected} onClose={() => setSelected(null)} />}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevPeriod}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={goToday}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Hoy
          </button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextPeriod}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Period label */}
        <span className="flex-1 text-center text-sm font-semibold capitalize min-w-[160px]">{periodLabel}</span>

        {/* Clock toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          {(["12h", "24h"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setClock(c)}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${clock === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* View selector */}
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          {(["month", "week", "day", "scheduler"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {v === "month" ? "Mes" : v === "week" ? "Semana" : v === "day" ? "Día" : "Programador"}
            </button>
          ))}
        </div>
      </div>

      {/* View content */}
      {view === "month" && (
        <MonthView
          year={monthDate.year}
          month={monthDate.month}
          appointments={appointments}
          today={today}
          onDayClick={(ymd) => {
            setCurrentDay(ymd);
            setView("day");
            navigate(mondayOf(ymd));
          }}
        />
      )}

      {view === "week" && (
        <TimeGrid
          hourStart={hourStart}
          hourEnd={hourEnd}
          columns={weekColumns}
          apptsByCol={byDay}
          onSelect={setSelected}
          clock={clock}
        />
      )}

      {view === "day" && (
        <>
          {/* Day selector within week */}
          <div className="flex gap-1 mb-3 overflow-x-auto">
            {weekDays.map((ymd, i) => {
              const d = new Date(`${ymd}T12:00:00Z`);
              const isActive = ymd === currentDay;
              const isToday = ymd === today;
              const count = byDay[ymd]?.length ?? 0;
              return (
                <button
                  key={ymd}
                  onClick={() => setCurrentDay(ymd)}
                  className={`flex flex-col items-center rounded-xl px-3 py-2 min-w-[48px] transition-colors ${isActive ? "bg-primary text-primary-foreground" : isToday ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                >
                  <span className="text-[10px] font-medium">{DAY_NAMES_SHORT[i]}</span>
                  <span className="text-lg font-bold leading-tight">{d.getUTCDate()}</span>
                  {count > 0 && (
                    <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isActive ? "bg-primary-foreground" : "bg-primary"}`} />
                  )}
                </button>
              );
            })}
          </div>
          <TimeGrid
            hourStart={hourStart}
            hourEnd={hourEnd}
            columns={dayColumns}
            apptsByCol={{ [currentDay]: byDay[currentDay] ?? [] }}
            onSelect={setSelected}
            clock={clock}
          />
        </>
      )}

      {view === "scheduler" && (
        <>
          {/* Day selector */}
          <div className="flex gap-1 mb-3 overflow-x-auto">
            {weekDays.map((ymd, i) => {
              const d = new Date(`${ymd}T12:00:00Z`);
              const isActive = ymd === currentDay;
              const isToday = ymd === today;
              const count = byDay[ymd]?.length ?? 0;
              return (
                <button
                  key={ymd}
                  onClick={() => setCurrentDay(ymd)}
                  className={`flex flex-col items-center rounded-xl px-3 py-2 min-w-[48px] transition-colors ${isActive ? "bg-primary text-primary-foreground" : isToday ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                >
                  <span className="text-[10px] font-medium">{DAY_NAMES_SHORT[i]}</span>
                  <span className="text-lg font-bold leading-tight">{d.getUTCDate()}</span>
                  {count > 0 && (
                    <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isActive ? "bg-primary-foreground" : "bg-primary"}`} />
                  )}
                </button>
              );
            })}
          </div>
          {staffCols.length === 0 || (staffCols.length === 1 && staffCols[0] === "Sin asignar" && (byDay[currentDay]?.length ?? 0) === 0) ? (
            <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
              Sin citas asignadas para este día.
            </div>
          ) : (
            <TimeGrid
              hourStart={hourStart}
              hourEnd={hourEnd}
              columns={schedulerColumns}
              apptsByCol={byStaff}
              onSelect={setSelected}
              clock={clock}
            />
          )}
        </>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3">
        {(["pending","confirmed","arrived","in_progress","completed","no_show"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
            {formatStatus(s)}
          </span>
        ))}
      </div>
    </>
  );
}
