const {
  isWithinBaseSchedule,
  hasAbsenceOverlap,
  isStaffAvailable,
  hasBaseScheduleOverlap,
} = require("../domain/rules/availability-resolution.rules");

describe("isWithinBaseSchedule", () => {
  const base = [{ weekday: 2, startTime: "08:00", endTime: "18:00" }];

  test("dentro del horario base", () => {
    expect(isWithinBaseSchedule(base, 2, "10:00", "11:00")).toBe(true);
  });
  test("fuera del horario base", () => {
    expect(isWithinBaseSchedule(base, 2, "19:00", "20:00")).toBe(false);
  });
  test("sin horario base para ese día", () => {
    expect(isWithinBaseSchedule(base, 5, "10:00", "11:00")).toBe(false);
  });
});

describe("hasAbsenceOverlap", () => {
  const absences = [{ startAt: new Date("2026-07-10T12:00:00Z"), endAt: new Date("2026-07-10T14:00:00Z") }];

  test("rango solapado", () => {
    expect(hasAbsenceOverlap(absences, "2026-07-10T13:00:00Z", "2026-07-10T15:00:00Z")).toBe(true);
  });
  test("rango no solapado", () => {
    expect(hasAbsenceOverlap(absences, "2026-07-10T15:00:00Z", "2026-07-10T16:00:00Z")).toBe(false);
  });
});

describe("isStaffAvailable", () => {
  const rows = [
    { type: "base_schedule", weekday: 2, startTime: "08:00", endTime: "18:00" },
    { type: "unplanned_absence", startAt: new Date("2026-07-14T12:00:00Z"), endAt: new Date("2026-07-14T14:00:00Z") },
  ];

  test("disponible dentro de horario y sin ausencias", () => {
    const result = isStaffAvailable(rows, {
      weekday: 2,
      startTime: "09:00",
      endTime: "10:00",
      rangeStart: "2026-07-14T09:00:00Z",
      rangeEnd: "2026-07-14T10:00:00Z",
    });
    expect(result).toBe(true);
  });

  test("no disponible si hay ausencia en el rango, aunque esté dentro de horario", () => {
    const result = isStaffAvailable(rows, {
      weekday: 2,
      startTime: "13:00",
      endTime: "14:00",
      rangeStart: "2026-07-14T13:00:00Z",
      rangeEnd: "2026-07-14T14:00:00Z",
    });
    expect(result).toBe(false);
  });

  test("no disponible fuera de horario base", () => {
    const result = isStaffAvailable(rows, {
      weekday: 2,
      startTime: "19:00",
      endTime: "20:00",
      rangeStart: "2026-07-14T19:00:00Z",
      rangeEnd: "2026-07-14T20:00:00Z",
    });
    expect(result).toBe(false);
  });
});

describe("hasBaseScheduleOverlap — excepción documentada (Decisión Diferida #6)", () => {
  const existing = [{ weekday: 1, startTime: "08:00", endTime: "12:00" }];

  test("detecta solapamiento en el mismo día", () => {
    expect(hasBaseScheduleOverlap(existing, 1, "11:00", "13:00")).toBe(true);
  });
  test("no detecta solapamiento si no hay intersección", () => {
    expect(hasBaseScheduleOverlap(existing, 1, "12:00", "14:00")).toBe(false);
  });
  test("no detecta solapamiento en otro día", () => {
    expect(hasBaseScheduleOverlap(existing, 2, "08:00", "12:00")).toBe(false);
  });
});
