/**
 * Entregable 6.2 (Fase 6) — cobertura del cierre de bypass detectado por grep
 * exhaustivo en la Macroetapa 3: `checkAppointmentConflict` (usado en la
 * confirmación final del flujo de WhatsApp) era el único consumidor real de
 * `isSlotAvailable` que no transportaba `tenantId`, quedando fuera de la
 * fuente de verdad de `Tenant.businessHours` aplicada al resto del flujo.
 */
jest.mock("../../services/availability-db.service", () => ({
  isSlotAvailable: jest.fn(),
}));

const availabilityDb = require("../../services/availability-db.service");
const { checkAppointmentConflict } = require("../../services/appointment.service");

beforeEach(() => jest.clearAllMocks());

describe("checkAppointmentConflict — transporte de tenantId (Entregable 6.2)", () => {
  test("propaga tenantId a isSlotAvailable", async () => {
    availabilityDb.isSlotAvailable.mockResolvedValue(true);

    await checkAppointmentConflict({
      dateKey: "2026-01-08",
      hour: 12,
      serviceType: "veterinary_consultation",
      tenantId: "tenant-1",
    });

    expect(availabilityDb.isSlotAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ dateKey: "2026-01-08", hour: 12, tenantId: "tenant-1" })
    );
  });

  test("sin tenantId, sigue funcionando (comportamiento legado vía isSlotAvailable)", async () => {
    availabilityDb.isSlotAvailable.mockResolvedValue(true);

    const hasConflict = await checkAppointmentConflict({
      dateKey: "2026-01-08",
      hour: 12,
      serviceType: "veterinary_consultation",
    });

    expect(hasConflict).toBe(false);
    expect(availabilityDb.isSlotAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: undefined })
    );
  });

  test("slot no disponible reporta conflicto", async () => {
    availabilityDb.isSlotAvailable.mockResolvedValue(false);

    const hasConflict = await checkAppointmentConflict({
      dateKey: "2026-01-08",
      hour: 12,
      serviceType: "veterinary_consultation",
      tenantId: "tenant-1",
    });

    expect(hasConflict).toBe(true);
  });
});
