const { parseDateToKey, parseTimeToHour, formatHourAmPm, extractExplicitSchedulingTerms } = require("../../services/scheduling.service");

test("la conversación conserva minutos escritos y rechaza horas inválidas", () => {
  expect(parseTimeToHour("10:30 am")).toBe(10.5);
  expect(parseTimeToHour("2:15 pm")).toBe(14.25);
  expect(parseTimeToHour("10:20")).toBe(10 + 20 / 60);
  expect(parseTimeToHour("10:75 am")).toBeNull();
  expect(parseTimeToHour("24:30")).toBeNull();
  expect(formatHourAmPm(10.5)).toBe("10:30am");
  expect(formatHourAmPm(14.25)).toBe("2:15pm");
});
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

  test("fecha explícita prevalece sobre el próximo día de la semana", () => {
    const ref = new Date("2026-09-26T21:40:56Z");
    const holiday = parseDateToKey("Quiero cita veterinaria para Akiles el lunes 12 de octubre a las 12:00", ref);
    expect(holiday).toBe("2026-10-12");
    expect(isBusinessDay(holiday)).toBe(false);
    expect(parseDateToKey("lunes 28 de septiembre", ref)).toBe("2026-09-28");
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

describe("extractExplicitSchedulingTerms", () => {
  test("prioriza la fecha y hora escritas en el turno actual", () => {
    expect(extractExplicitSchedulingTerms("el sábado a las 4 pm", REF_JUNE)).toEqual({
      dateText: "el sábado a las 4 pm",
      timeText: "4 pm",
    });
  });

  test("no confunde el día del mes con la hora en una solicitud completa", () => {
    const terms = extractExplicitSchedulingTerms("Quiero cita veterinaria para Akiles el lunes 28 de septiembre a las 12:00", new Date("2026-09-26T19:26:44Z"));
    expect(terms.dateText).toContain("lunes 28 de septiembre");
    expect(terms.timeText).toBe("a las 12:00");
    expect(parseTimeToHour(terms.timeText)).toBe(12);
  });

  test("no trata un nombre de mascota como una fecha u hora", () => {
    expect(extractExplicitSchedulingTerms("Benji", REF_JUNE)).toEqual({
      dateText: null,
      timeText: null,
    });
  });
});
