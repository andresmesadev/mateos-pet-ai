/**
 * Entregable 6.2 (Fase 6) — cobertura de regresión mínima construida ANTES de
 * la Reconciliación Arquitectónica puntual sobre `availability.service.js`,
 * exigida por la Macroetapa 1 dado que esta capa no tenía ninguna prueba
 * previa. Fija el comportamiento actual (sin configuración de establecimiento)
 * y añade cobertura del nuevo parámetro de configuración por establecimiento.
 */
const {
  isBusinessDay,
  isWithinBusinessHours,
  SERVICE_TYPES,
} = require("../../services/availability.service");

describe("isBusinessDay — comportamiento sin configuración de establecimiento (legado)", () => {
  test("un jueves ordinario es día hábil", () => {
    expect(isBusinessDay("2026-01-08")).toBe(true);
  });

  test("un domingo nunca es día hábil", () => {
    expect(isBusinessDay("2026-01-11")).toBe(false);
  });

  test("un festivo colombiano (Año Nuevo) no es día hábil aunque no sea domingo", () => {
    expect(isBusinessDay("2026-01-01")).toBe(false);
  });

  test("una fecha inválida no es día hábil", () => {
    expect(isBusinessDay("no-es-una-fecha")).toBe(false);
  });
});

describe("isWithinBusinessHours — comportamiento sin configuración de establecimiento (legado)", () => {
  test("vet: dentro de 11am-5pm es válido", () => {
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, 11)).toBe(true);
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, 16)).toBe(true);
  });

  test("vet: 17h (cierre) ya no es válido", () => {
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, 17)).toBe(false);
  });

  test("vet: antes de las 11am no es válido", () => {
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, 10)).toBe(false);
  });

  test("grooming: dentro de 11am-4pm (último turno) es válido", () => {
    expect(isWithinBusinessHours(SERVICE_TYPES.GROOMING, 11)).toBe(true);
    expect(isWithinBusinessHours(SERVICE_TYPES.GROOMING, 16)).toBe(true);
  });

  test("grooming: 17h no es válido", () => {
    expect(isWithinBusinessHours(SERVICE_TYPES.GROOMING, 17)).toBe(false);
  });

  test("hora inválida no es válida", () => {
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, 25)).toBe(false);
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, NaN)).toBe(false);
  });

  test("tipo de servicio desconocido no es válido", () => {
    expect(isWithinBusinessHours("desconocido", 12)).toBe(false);
  });
});

describe("isBusinessDay — con configuración real del establecimiento (Entregable 6.2)", () => {
  test("establecimiento configurado abierto un domingo (active=true) reemplaza el default 'no domingo'", () => {
    const businessHours = { sun: { open: "10:00", close: "14:00", active: true } };
    expect(isBusinessDay("2026-01-11", businessHours)).toBe(true);
  });

  test("establecimiento configurado cerrado un jueves (active=false) anula el default 'día hábil'", () => {
    const businessHours = { thu: { open: "08:00", close: "18:00", active: false } };
    expect(isBusinessDay("2026-01-08", businessHours)).toBe(false);
  });

  test("un festivo sigue cerrado incluso si el día está configurado como active=true", () => {
    const businessHours = { thu: { open: "08:00", close: "18:00", active: true } };
    expect(isBusinessDay("2026-01-01", businessHours)).toBe(false);
  });

  test("configuración sin entrada para ese día cae al comportamiento legado", () => {
    const businessHours = { mon: { open: "08:00", close: "18:00", active: true } };
    expect(isBusinessDay("2026-01-11", businessHours)).toBe(false); // domingo, sin entrada "sun"
  });

  test("configuración malformada (falta open/close) cae al comportamiento legado", () => {
    const businessHours = { thu: { active: true } };
    expect(isBusinessDay("2026-01-08", businessHours)).toBe(true); // jueves ordinario, legado
  });
});

describe("isWithinBusinessHours — con configuración real del establecimiento (Entregable 6.2)", () => {
  test("horario configurado del establecimiento reemplaza el hardcode por tipo de servicio", () => {
    const businessHours = { thu: { open: "08:00", close: "12:00", active: true } };
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, 9, "2026-01-08", businessHours)).toBe(true);
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, 13, "2026-01-08", businessHours)).toBe(false);
    expect(isWithinBusinessHours(SERVICE_TYPES.GROOMING, 9, "2026-01-08", businessHours)).toBe(true);
    expect(isWithinBusinessHours(SERVICE_TYPES.GROOMING, 13, "2026-01-08", businessHours)).toBe(false);
  });

  test("día configurado como inactivo (active=false) invalida cualquier hora", () => {
    const businessHours = { thu: { open: "08:00", close: "18:00", active: false } };
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, 12, "2026-01-08", businessHours)).toBe(false);
  });

  test("sin dateKey, ignora la configuración y usa el comportamiento legado", () => {
    const businessHours = { thu: { open: "08:00", close: "12:00", active: true } };
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, 15, undefined, businessHours)).toBe(true);
  });

  test("dateKey sin entrada configurada para ese día cae al comportamiento legado", () => {
    const businessHours = { mon: { open: "08:00", close: "12:00", active: true } };
    expect(isWithinBusinessHours(SERVICE_TYPES.VET, 15, "2026-01-08", businessHours)).toBe(true); // jueves, sin entrada "thu" -> legado
  });
});
