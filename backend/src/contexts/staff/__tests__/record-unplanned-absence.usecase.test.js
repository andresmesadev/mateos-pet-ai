const { createRecordUnplannedAbsenceUseCase } = require("../application/use-cases/record-unplanned-absence.usecase");
const { createFakeStaffRepository, createFakeAvailabilityRepository, createFakeEventPublisher } = require("./fakes");
const { StaffNotFoundError, InvalidAvailabilityRangeError } = require("../domain/errors");

function buildUseCase() {
  const staffRepository = createFakeStaffRepository([{ id: "s-1", tenantId: "t1", name: "Lina", active: true }]);
  const availabilityRepository = createFakeAvailabilityRepository();
  const eventPublisher = createFakeEventPublisher();
  const execute = createRecordUnplannedAbsenceUseCase({ staffRepository, availabilityRepository, eventPublisher });
  return { execute, eventPublisher };
}

describe("RecordUnplannedAbsenceUseCase", () => {
  test("registra la ausencia y emite DisponibilidadActualizada con origin unplanned", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { availability } = await execute({ staffId: "s-1", startAt: "2026-07-10T08:00:00Z", endAt: "2026-07-10T12:00:00Z" });
    expect(availability.type).toBe("unplanned_absence");
    expect(eventPublisher.events[0].payload.origin).toBe("unplanned");
    // Entregable 5.2 — Certificación Real de Eventos por Contexto.
    expect(eventPublisher.events[0].payload.tenantId).toBe("t1");
  });

  test("rechaza si el staff no existe", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ staffId: "no-existe", startAt: "2026-07-10T08:00:00Z", endAt: "2026-07-10T12:00:00Z" })
    ).rejects.toBeInstanceOf(StaffNotFoundError);
  });

  test("rechaza rango inválido", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ staffId: "s-1", startAt: "2026-07-10T12:00:00Z", endAt: "2026-07-10T08:00:00Z" })
    ).rejects.toBeInstanceOf(InvalidAvailabilityRangeError);
  });

  test("Entregable 6.3 — rechaza como StaffNotFoundError si el staff pertenece a otro tenant", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ staffId: "s-1", startAt: "2026-07-10T08:00:00Z", endAt: "2026-07-10T12:00:00Z", tenantId: "t2" })
    ).rejects.toBeInstanceOf(StaffNotFoundError);
  });
});
