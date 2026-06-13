const { parseDateToKey } = require("../../services/scheduling.service");
const {
  isBusinessDay,
  addOneDay,
} = require("../../services/availability.service");
const { toDateKey } = require("../../lib/timezone");

const REF_MARCH = new Date("2026-03-01T17:00:00.000Z");
const REF_JUNE = new Date("2026-06-10T17:00:00.000Z");
const REF_DECEMBER = new Date("2025-12-15T17:00:00.000Z");

const getNextBusinessDay = (dateKey) => {
  let cursor = dateKey;
  let guard = 0;

  while (!isBusinessDay(cursor) && guard < 14) {
    cursor = addOneDay(cursor);
    guard += 1;
  }

  return cursor;
};

describe("parseDateToKey", () => {
  test('"hoy" → fecha actual en Bogotá', () => {
    expect(parseDateToKey("hoy", REF_JUNE)).toBe("2026-06-10");
  });

  test('"mañana" → fecha siguiente', () => {
    expect(parseDateToKey("mañana", REF_JUNE)).toBe("2026-06-11");
  });

  test.each([
    ["lunes", "2026-06-15"],
    ["martes", "2026-06-16"],
    ["miercoles", "2026-06-17"],
    ["jueves", "2026-06-11"],
    ["viernes", "2026-06-12"],
    ["sabado", "2026-06-13"],
    ["domingo", "2026-06-14"],
  ])('"%s" → próximo %s desde miércoles 2026-06-10', (weekday, expected) => {
    expect(parseDateToKey(weekday, REF_JUNE)).toBe(expected);
  });

  test('"19/05" → formato dd/MM correcto', () => {
    expect(parseDateToKey("19/05", REF_MARCH)).toBe("2026-05-19");
  });

  test('"19 de mayo" → formato natural correcto', () => {
    expect(parseDateToKey("19 de mayo", REF_MARCH)).toBe("2026-05-19");
  });

  test("festivo Colombia → siguiente día hábil", () => {
    const parsed = parseDateToKey("1 de enero", REF_DECEMBER);

    expect(parsed).toBe("2026-01-01");
    expect(isBusinessDay(parsed)).toBe(false);
    expect(getNextBusinessDay(parsed)).toBe("2026-01-02");
  });
});

describe("parseDateToKey reference alignment", () => {
  test("usa timezone America/Bogota como referencia", () => {
    expect(toDateKey(REF_JUNE)).toBe("2026-06-10");
  });
});
