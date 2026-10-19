/**
 * Entregable 6.2 (Fase 6) — cobertura de regresión mínima construida ANTES de
 * ampliar la Reconciliación Arquitectónica puntual a `availability-db.service.js`
 * (segundo consumidor real detectado en el checkpoint de la Macroetapa 2).
 * Fija el comportamiento actual (sin configuración de establecimiento) y
 * añade cobertura del nuevo parámetro `tenantId`, verificando que las
 * sugerencias generadas usan la misma fuente que la validación directa.
 */
jest.mock("../../lib/prisma", () => ({
  appointment: { findMany: jest.fn() },
  tenant: { findUnique: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const {
  isSlotAvailable,
  listAvailableSlotsForDate,
  suggestAvailableVetSlots,
  findNextAvailableGroomingSlot,
} = require("../../services/availability-db.service");

const THURSDAY = "2026-01-08"; // jueves ordinario, sin festivos
const PILOT_HOURS = {
  thu: { open: "11:00", close: "17:00", active: true },
  sun: { open: "11:00", close: "17:00", active: false },
  services: {
    vet: {
      thu: { open: "11:00", close: "17:00", active: true },
      sun: { open: "11:00", close: "17:00", active: false },
    },
    grooming: {
      thu: { open: "11:00", close: "17:00", active: true },
      sun: { open: "11:00", close: "17:00", active: false },
    },
  },
};
const appointmentAt = (hour, serviceType) => ({
  id: `a-${hour}`,
  date: new Date(Date.UTC(2026, 0, 8, 5, Math.round(hour * 60))),
  serviceType,
  status: "confirmed",
});

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(new Date("2026-01-07T12:00:00Z"));
  jest.clearAllMocks();
  prisma.appointment.findMany.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());

test("expired grooming gaps do not block afternoon, future gaps still do", async () => {
  prisma.tenant.findUnique.mockResolvedValue({ businessHours: PILOT_HOURS });
  const at = new Date("2026-01-08T16:51:00Z"); // 11:51 Colombia: next reservable reception is 12:40.
  const options = { tenantId: "t-1", dateKey: THURSDAY, serviceType: "grooming", referenceDate: at };
  await expect(isSlotAvailable({ ...options, hour: 12 + 40 / 60 })).resolves.toBe(true);
  await expect(isSlotAvailable({ ...options, hour: 14 })).resolves.toBe(false);
  await expect(isSlotAvailable({ ...options, dateKey: "2026-01-07", hour: 13 })).resolves.toBe(false);
});

describe("horarios con minutos sin cambiar la capacidad de un turno", () => {
  const referenceDate = new Date("2026-01-07T12:00:00Z");
  const options = { dateKey: THURSDAY, tenantId: "t-1", referenceDate };
  beforeEach(() => prisma.tenant.findUnique.mockResolvedValue({ businessHours: { thu: { active: true, open: "10:30", close: "15:10" } } }));

  test("lista turnos desde la apertura exacta y exige que quepan antes del cierre", async () => {
    await expect(listAvailableSlotsForDate({ ...options, serviceType: "vet" })).resolves.toEqual([10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14]);
    await expect(listAvailableSlotsForDate({ ...options, serviceType: "grooming" })).resolves.toEqual([10.5]);
    await expect(isSlotAvailable({ ...options, serviceType: "vet", hour: 14.5 })).resolves.toBe(false);
    await expect(suggestAvailableVetSlots({ ...options })).resolves.toEqual({ dateKey: THURSDAY, hours: [10.5, 11.5, 12.5] });
  });

  test("peluquería conserva orden y separación de 20 minutos desde las 10:30", async () => {
    await expect(isSlotAvailable({ ...options, serviceType: "grooming", hour: 10 + 50 / 60 })).resolves.toBe(false);
    prisma.appointment.findMany.mockResolvedValue([{ id: "minutes", date: new Date("2026-01-08T15:30:00Z"), serviceType: "grooming", status: "confirmed" }]);
    await expect(isSlotAvailable({ ...options, serviceType: "grooming", hour: 10 + 50 / 60 })).resolves.toBe(true);
    await expect(isSlotAvailable({ ...options, serviceType: "grooming", hour: 11.75 })).resolves.toBe(false);
  });

  test("respeta aperturas a las 10:20 también en sugerencias", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ businessHours: { thu: { active: true, open: "10:20", close: "15:10" } } });
    const first = 10 + 20 / 60;
    await expect(findNextAvailableGroomingSlot({ tenantId: "t-1", referenceDate: new Date("2026-01-08T12:00:00Z") })).resolves.toEqual({ date: THURSDAY, hour: first });
  });
});

describe("isSlotAvailable — comportamiento legado (sin tenantId)", () => {
  test("hora dentro del horario legado vet (11am-5pm) sin citas previas está disponible", async () => {
    const available = await isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "vet" });
    expect(available).toBe(true);
  });

  test("hora fuera del horario legado vet (17h) no está disponible", async () => {
    const available = await isSlotAvailable({ dateKey: THURSDAY, hour: 17, serviceType: "vet" });
    expect(available).toBe(false);
  });

  test("día no hábil (domingo) nunca está disponible", async () => {
    const available = await isSlotAvailable({ dateKey: "2026-01-11", hour: 12, serviceType: "vet" });
    expect(available).toBe(false);
  });
});

describe("isSlotAvailable — con tenantId y configuración real del establecimiento", () => {
  test("tenantId sin configuración propia (Tenant.businessHours null) usa comportamiento legado", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ businessHours: null });
    const available = await isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "vet", tenantId: "t-1" });
    expect(available).toBe(true);
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: "t-1" }, select: { businessHours: true } });
  });

  test("configuración real del establecimiento reemplaza el horario legado", async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      businessHours: { thu: { open: "08:00", close: "10:00", active: true } },
    });
    const withinConfig = await isSlotAvailable({ dateKey: THURSDAY, hour: 9, serviceType: "vet", tenantId: "t-1" });
    const outsideConfig = await isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "vet", tenantId: "t-1" });
    expect(withinConfig).toBe(true);
    expect(outsideConfig).toBe(false); // 12h estaría dentro del horario legado, pero fuera del configurado
  });

  test("un fallo leyendo la configuración del establecimiento bloquea la reserva", async () => {
    prisma.tenant.findUnique.mockRejectedValue(new Error("db down"));
    const available = await isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "vet", tenantId: "t-1" });
    expect(available).toBe(false);
  });
});

describe("matriz de agenda de la beta — horario temporal 11:00–17:00", () => {
  beforeEach(() => prisma.tenant.findUnique.mockResolvedValue({ businessHours: PILOT_HOURS }));

  test.each(["vet", "bath_grooming"])("%s: abre a las 11, cierra a las 17 y rechaza domingos y festivos", async (serviceType) => {
    for (const [dateKey, hour, expected] of [
      [THURSDAY, 10, false],
      [THURSDAY, 11, true],
      [THURSDAY, 16, serviceType === "vet"],
      [THURSDAY, 17, false],
      ["2026-01-11", 12, false],
      ["2026-01-01", 12, false],
    ]) {
      await expect(isSlotAvailable({ dateKey, hour, serviceType, tenantId: "t-1" })).resolves.toBe(expected);
    }
  });

  test("veterinaria permite otra hora libre, pero bloquea la hora ocupada", async () => {
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(11, "vet")]);
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 11, serviceType: "vet", tenantId: "t-1" })).resolves.toBe(false);
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 13, serviceType: "vet", tenantId: "t-1" })).resolves.toBe(true);
  });

  test("una consulta a y media no se solapa con la hora anterior o siguiente", async () => {
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(11, "vet")]);
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 10.5, serviceType: "vet", tenantId: "t-1" })).resolves.toBe(false);
    prisma.appointment.findMany.mockResolvedValue([{ ...appointmentAt(10, "vet"), date: new Date("2026-01-08T15:30:00Z") }]);
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 11, serviceType: "vet", tenantId: "t-1" })).resolves.toBe(false);
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "vet", tenantId: "t-1" })).resolves.toBe(true);
  });

  test("una consulta a y media debe terminar dentro del horario de atención", async () => {
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 16.5, serviceType: "vet", tenantId: "t-1" })).resolves.toBe(false);
  });

  test("el formulario ofrece solo medias horas veterinarias libres dentro del horario", async () => {
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(12, "vet")]);
    const slots = await listAvailableSlotsForDate({ dateKey: THURSDAY, serviceType: "vet", tenantId: "t-1" });
    expect(slots).toEqual([11, 13, 13.5, 14, 14.5, 15, 15.5, 16]);
    expect(prisma.appointment.findMany).toHaveBeenCalledTimes(1);
  });

  test("el formulario de peluquería ofrece la próxima recepción 20 minutos después", async () => {
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(11, "grooming")]);
    const slots = await listAvailableSlotsForDate({ dateKey: THURSDAY, serviceType: "grooming", tenantId: "t-1" });
    expect(slots).toEqual([11 + 20 / 60]);
  });

  test("un día cerrado no ofrece turnos", async () => {
    await expect(listAvailableSlotsForDate({ dateKey: "2026-01-11", serviceType: "vet", tenantId: "t-1" })).resolves.toEqual([]);
  });

  test("peluquería no permite saltar el primer turno libre", async () => {
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "bath_grooming", tenantId: "t-1" })).resolves.toBe(false);
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(11, "bath_grooming")]);
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 11 + 20 / 60, serviceType: "bath_grooming", tenantId: "t-1" })).resolves.toBe(true);
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 13, serviceType: "bath_grooming", tenantId: "t-1" })).resolves.toBe(false);
  });

  test("una cita cancelada libera el turno de peluquería", async () => {
    prisma.appointment.findMany.mockResolvedValue([]); // La consulta excluye status=cancelled.
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 11, serviceType: "bath_grooming", tenantId: "t-1" })).resolves.toBe(true);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { not: "cancelled" } }),
    }));
  });

  test("si falla la lectura del horario no se ofrecen turnos", async () => {
    prisma.tenant.findUnique.mockRejectedValue(new Error("db down"));
    await expect(findNextAvailableGroomingSlot({ referenceDate: new Date("2026-01-08T06:00:00Z"), tenantId: "t-1" })).resolves.toBeNull();
    await expect(suggestAvailableVetSlots({ dateKey: THURSDAY, tenantId: "t-1" })).resolves.toEqual({ dateKey: THURSDAY, hours: [] });
  });
});

describe("isSlotAvailable — hora ya pasada hoy (hallazgo operativo 2026-09-03)", () => {
  test("una hora ya pasada hoy (con margen de 30 min) no está disponible, aunque nada la haya reservado", async () => {
    // referenceDate: 1pm hora Bogotá del mismo THURSDAY — la hora 12 (mediodía) ya pasó
    const referenceDate = new Date("2026-01-08T18:00:00.000Z");
    const available = await isSlotAvailable({
      dateKey: THURSDAY,
      hour: 12,
      serviceType: "vet",
      referenceDate,
    });
    expect(available).toBe(false);
  });

  test("una hora futura hoy sigue disponible", async () => {
    const referenceDate = new Date("2026-01-08T18:00:00.000Z"); // 1pm Bogotá
    const available = await isSlotAvailable({
      dateKey: THURSDAY,
      hour: 15,
      serviceType: "vet",
      referenceDate,
    });
    expect(available).toBe(true);
  });

  test("sin referenceDate (comportamiento por defecto) no filtra por fecha distinta a la real de hoy", async () => {
    // THURSDAY es una fecha fija de prueba, no "hoy" real — no debe filtrarse por hora pasada.
    const available = await isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "vet" });
    expect(available).toBe(true);
  });
});

describe("suggestAvailableVetSlots — sugerencias consistentes con la configuración real", () => {
  test("sin tenantId, sugiere dentro del horario legado (11-16)", async () => {
    const { hours } = await suggestAvailableVetSlots({ dateKey: THURSDAY, requestedHour: 12 });
    expect(hours.every((h) => h >= 11 && h < 17)).toBe(true);
    expect(hours).not.toContain(12); // hora solicitada excluida
  });

  test("con establecimiento configurado, nunca sugiere una hora fuera de su horario real", async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      businessHours: { thu: { open: "08:00", close: "10:00", active: true } },
    });
    const { hours } = await suggestAvailableVetSlots({ dateKey: THURSDAY, requestedHour: 8, tenantId: "t-1" });
    expect(hours.every((h) => h >= 8 && h < 10)).toBe(true);
    expect(hours).not.toContain(12); // 12h era válido en el horario legado, pero no en el configurado
  });

  test("no sugiere horas ya pasadas hoy (hallazgo operativo 2026-09-03)", async () => {
    const referenceDate = new Date("2026-01-08T18:00:00.000Z"); // 1pm Bogotá
    const { hours } = await suggestAvailableVetSlots({ dateKey: THURSDAY, referenceDate });
    expect(hours.every((h) => h >= 14)).toBe(true); // 12h y 13h ya pasaron (con margen)
  });
});

describe("isSlotAvailable — aislamiento cross-tenant (hallazgo de seguridad F4, 2026-09-07)", () => {
  beforeEach(() => {
    prisma.tenant.findUnique.mockResolvedValue({ businessHours: null });
  });

  test("con tenantId, la consulta de citas se filtra a ese tenant (directo o vía dueño)", async () => {
    await isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "vet", tenantId: "t-1" });

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ tenantId: "t-1" }, { user: { tenantId: "t-1" } }],
        }),
      })
    );
  });

  test("una cita confirmada de OTRO tenant no ocupa el slot del tenant consultado", async () => {
    // El mock ignora el `where` (no es una BD real) — simula que la única
    // cita del día pertenece a otro tenant, y confirma que igual se reporta
    // disponible porque el filtro ya se aplicó en la consulta real.
    prisma.appointment.findMany.mockResolvedValue([]);

    const available = await isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "vet", tenantId: "t-1" });
    expect(available).toBe(true);
  });

  test("sin tenantId, conserva el comportamiento legado (sin filtro por tenant)", async () => {
    await isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "vet" });

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ OR: expect.anything() }),
      })
    );
  });
});

describe("findNextAvailableGroomingSlot — coherente con la configuración real", () => {
  test('manual today offers every free reception including past hours, autonomous bookings keep lead time and sequence', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ businessHours: PILOT_HOURS });
    const options = { tenantId: 't-1', dateKey: THURSDAY, serviceType: 'grooming', referenceDate: new Date('2026-01-08T19:00:00Z') };
    expect(await listAvailableSlotsForDate({ ...options, manual: true })).toEqual(Array.from({ length: 18 }, (_, i) => (660 + i * 20) / 60));
    expect(await isSlotAvailable({ ...options, manual: true, hour: 11 })).toBe(true);
    expect(await isSlotAvailable({ ...options, hour: 11 })).toBe(false);
    expect(await isSlotAvailable({ ...options, hour: 16 })).toBe(false);
    expect(await isSlotAvailable({ ...options, manual: true, hour: 11.5 })).toBe(false);
    expect(await listAvailableSlotsForDate({ ...options, dateKey: '2026-01-07', manual: true })).toEqual([]);
  });

  test('manual area hours override habitual hours, unset/invalid area falls back, explicit closure stays closed', async () => {
    const hours = { thu: { active: true, open: '08:00', close: '10:00' }, services: { grooming: { thu: { active: true, open: '09:00', close: '10:00' } } } };
    prisma.tenant.findUnique.mockResolvedValue({ businessHours: hours });
    const options = { dateKey: THURSDAY, serviceType: 'grooming', tenantId: 't-1', manual: true };
    expect(await listAvailableSlotsForDate(options)).toEqual([9, 9 + 20 / 60, 9 + 40 / 60]);
    delete hours.services.grooming.thu;
    expect(await listAvailableSlotsForDate(options)).toHaveLength(6);
    hours.services.grooming.thu = { active: true, open: '', close: '' };
    expect((await listAvailableSlotsForDate(options))[0]).toBe(8);
    hours.services.grooming.thu = { active: false };
    expect(await listAvailableSlotsForDate(options)).toEqual([]);
  });

  test('manual past reception still respects collisions and the configured closing time', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ businessHours: PILOT_HOURS });
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(11, 'grooming')]);
    const options = { dateKey: THURSDAY, serviceType: 'grooming', tenantId: 't-1', manual: true, referenceDate: new Date('2026-01-08T20:00:00Z') };
    expect(await isSlotAvailable({ ...options, hour: 11 })).toBe(false);
    expect(await isSlotAvailable({ ...options, hour: 11 + 20 / 60 })).toBe(true);
    expect(await isSlotAvailable({ ...options, hour: 17 })).toBe(false);
  });

  test("recorre las 18 recepciones de 20 minutos sin errores decimales y no rebasa el cierre", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ businessHours: PILOT_HOURS });
    const rows = [];
    for (let minute = 660; minute < 1020; minute += 20) {
      prisma.appointment.findMany.mockResolvedValue([...rows]);
      const slots = await listAvailableSlotsForDate({ dateKey: THURSDAY, serviceType: 'bath_grooming', tenantId: 't-1' });
      expect(slots).toEqual([minute / 60]);
      rows.push(appointmentAt(minute / 60, 'grooming'));
    }
    prisma.appointment.findMany.mockResolvedValue(rows);
    await expect(listAvailableSlotsForDate({ dateKey: THURSDAY, serviceType: 'grooming', tenantId: 't-1' })).resolves.toEqual([]);
  });

  test("sugerencia siguiente conserva :20 y :40, y una reserva desplazada bloquea cruces menores de 20 minutos", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ businessHours: PILOT_HOURS });
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(11, 'grooming'), appointmentAt(11 + 20 / 60, 'bath_grooming')]);
    await expect(findNextAvailableGroomingSlot({ tenantId: 't-1', referenceDate: new Date('2026-01-08T12:00:00Z') })).resolves.toEqual({ date: THURSDAY, hour: 11 + 40 / 60 });
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(11 + 10 / 60, 'grooming')]);
    await expect(isSlotAvailable({ dateKey: THURSDAY, serviceType: 'grooming', tenantId: 't-1', hour: 11 + 20 / 60 })).resolves.toBe(false);
  });

  test("apertura con minutos y cierre parcial aceptan solo recepciones completas", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ businessHours: { thu: { active: true, open: '10:30', close: '11:15' } } });
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(10.5, 'grooming')]);
    await expect(listAvailableSlotsForDate({ dateKey: THURSDAY, serviceType: 'grooming', tenantId: 't-1' })).resolves.toEqual([10 + 50 / 60]);
    await expect(isSlotAvailable({ dateKey: THURSDAY, serviceType: 'grooming', tenantId: 't-1', hour: 11 + 10 / 60 })).resolves.toBe(false);
  });

  test("con establecimiento configurado, el slot encontrado respeta esa ventana horaria", async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      businessHours: { thu: { open: "08:00", close: "10:00", active: true } },
    });
    const referenceDate = new Date("2026-01-08T06:00:00.000Z"); // temprano en el día, Bogotá
    const slot = await findNextAvailableGroomingSlot({ referenceDate, tenantId: "t-1" });
    expect(slot).not.toBeNull();
    expect(slot.hour).toBeGreaterThanOrEqual(8);
    expect(slot.hour).toBeLessThan(10);
  });
});
