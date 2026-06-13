const {
  zonedDateTimeToUtc,
  formatSlotForUser,
  formatInTimeZone,
  TIMEZONE,
} = require("../../lib/timezone");

describe("timezone", () => {
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
});
