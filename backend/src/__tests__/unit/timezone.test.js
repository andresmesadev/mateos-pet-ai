const {
  zonedDateTimeToUtc,
  formatSlotForUser,
  formatInTimeZone,
  TIMEZONE,
  isMinutePrecisionHour,
} = require("../../lib/timezone");

describe("timezone", () => {
  test("valida minutos y evita perder un minuto por precisión decimal", () => {
    expect(isMinutePrecisionHour(10 + 20 / 60)).toBe(true);
    expect(isMinutePrecisionHour(10.001)).toBe(false);
    expect(isMinutePrecisionHour(24)).toBe(false);
    expect(zonedDateTimeToUtc("2026-06-13", 17.2).toISOString()).toBe("2026-06-13T22:12:00.000Z");
  });
  test("zonedDateTimeToUtc('2026-06-13', 14) → UTC correcto", () => {
    const utc = zonedDateTimeToUtc("2026-06-13", 14);

    expect(utc).toBeInstanceOf(Date);
    expect(formatInTimeZone(utc, TIMEZONE, "yyyy-MM-dd HH:mm")).toBe(
      "2026-06-13 14:00"
    );
    expect(utc.toISOString()).toBe("2026-06-13T19:00:00.000Z");
  });

  test("formatSlotForUser('2026-06-13', 14) → texto Colombia", () => {
    expect(formatSlotForUser("2026-06-13", 14)).toBe(
      "13/06/2026 a las 2:00 PM (hora Colombia)"
    );
  });

  test("conserva los minutos de una reserva a y media en Bogotá", () => {
    expect(zonedDateTimeToUtc("2026-06-13", 10.5).toISOString()).toBe("2026-06-13T15:30:00.000Z");
    expect(formatSlotForUser("2026-06-13", 10.5)).toBe("13/06/2026 a las 10:30 AM (hora Colombia)");
  });
});
