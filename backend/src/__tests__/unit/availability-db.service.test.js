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
  date: new Date(`2026-01-08T${String(hour + 5).padStart(2, "0")}:00:00.000Z`),
  serviceType,
  status: "confirmed",
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.appointment.findMany.mockResolvedValue([]);
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

  test("peluquería conserva orden y separación de una hora desde las 10:30", async () => {
    await expect(isSlotAvailable({ ...options, serviceType: "grooming", hour: 11.5 })).resolves.toBe(false);
    prisma.appointment.findMany.mockResolvedValue([{ id: "minutes", date: new Date("2026-01-08T15:30:00Z"), serviceType: "grooming", status: "confirmed" }]);
    await expect(isSlotAvailable({ ...options, serviceType: "grooming", hour: 11.5 })).resolves.toBe(true);
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

  test("el formulario de peluquería conserva turnos consecutivos de hora completa", async () => {
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(11, "grooming")]);
    const slots = await listAvailableSlotsForDate({ dateKey: THURSDAY, serviceType: "grooming", tenantId: "t-1" });
    expect(slots).toEqual([12]);
  });

  test("un día cerrado no ofrece turnos", async () => {
    await expect(listAvailableSlotsForDate({ dateKey: "2026-01-11", serviceType: "vet", tenantId: "t-1" })).resolves.toEqual([]);
  });

  test("peluquería no permite saltar el primer turno libre", async () => {
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "bath_grooming", tenantId: "t-1" })).resolves.toBe(false);
    prisma.appointment.findMany.mockResolvedValue([appointmentAt(11, "bath_grooming")]);
    await expect(isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "bath_grooming", tenantId: "t-1" })).resolves.toBe(true);
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
