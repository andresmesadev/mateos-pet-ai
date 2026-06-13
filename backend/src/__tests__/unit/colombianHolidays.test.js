const {
  isColombianHoliday,
  getHolidayName,
} = require("../../lib/colombianHolidays");

describe("colombianHolidays", () => {
  test("isColombianHoliday('2026-01-01') → true (Año Nuevo)", () => {
    expect(isColombianHoliday("2026-01-01")).toBe(true);
  });

  test("isColombianHoliday('2026-12-25') → true (Navidad)", () => {
    expect(isColombianHoliday("2026-12-25")).toBe(true);
  });

  test("isColombianHoliday('2026-06-10') → false (día hábil)", () => {
    expect(isColombianHoliday("2026-06-10")).toBe(false);
  });

  test("getHolidayName('2026-01-12') → Reyes Magos", () => {
    expect(getHolidayName("2026-01-12")).toBe("Reyes Magos");
  });

  test("getHolidayName('2026-06-10') → null en día ordinario", () => {
    expect(getHolidayName("2026-06-10")).toBeNull();
  });
});
