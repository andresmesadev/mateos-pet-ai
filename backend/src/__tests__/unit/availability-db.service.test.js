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
  suggestAvailableVetSlots,
  findNextAvailableGroomingSlot,
} = require("../../services/availability-db.service");

const THURSDAY = "2026-01-08"; // jueves ordinario, sin festivos

beforeEach(() => {
  jest.clearAllMocks();
  prisma.appointment.findMany.mockResolvedValue([]);
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

  test("un fallo leyendo la configuración del establecimiento no rompe la verificación — cae a comportamiento legado", async () => {
    prisma.tenant.findUnique.mockRejectedValue(new Error("db down"));
    const available = await isSlotAvailable({ dateKey: THURSDAY, hour: 12, serviceType: "vet", tenantId: "t-1" });
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
