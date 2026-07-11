const { createUpdateAvailabilityUseCase } = require("../application/use-cases/update-availability.usecase");
const { createFakeStaffRepository, createFakeAvailabilityRepository, createFakeEventPublisher } = require("./fakes");
const { StaffNotFoundError, InvalidAvailabilityRangeError } = require("../domain/errors");

function buildUseCase(existingAvailability = []) {
  const staffRepository = createFakeStaffRepository([{ id: "s-1", tenantId: "t1", name: "Lina", active: true }]);
  const availabilityRepository = createFakeAvailabilityRepository(existingAvailability);
  const eventPublisher = createFakeEventPublisher();
  const execute = createUpdateAvailabilityUseCase({ staffRepository, availabilityRepository, eventPublisher });
  return { execute, availabilityRepository, eventPublisher };
}

describe("UpdateAvailabilityUseCase", () => {
  test("crea horario base y emite DisponibilidadActualizada", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { availability } = await execute({
      staffId: "s-1",
      type: "base_schedule",
      schedule: { weekday: 1, startTime: "08:00", endTime: "17:00" },
    });
    expect(availability.type).toBe("base_schedule");
    expect(eventPublisher.events[0].payload.origin).toBe("planned");
    // Entregable 5.2 — Certificación Real de Eventos por Contexto.
    expect(eventPublisher.events[0].payload.tenantId).toBe("t1");
  });

  test("crea ausencia programada", async () => {
    const { execute } = buildUseCase();
    const { availability } = await execute({
      staffId: "s-1",
      type: "planned_absence",
      range: { startAt: "2026-08-01T00:00:00Z", endAt: "2026-08-05T00:00:00Z", reason: "Vacaciones" },
    });
    expect(availability.type).toBe("planned_absence");
  });

  test("rechaza si el miembro no existe", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ staffId: "no-existe", type: "base_schedule", schedule: { weekday: 1, startTime: "08:00", endTime: "17:00" } })
    ).rejects.toBeInstanceOf(StaffNotFoundError);
  });

  test("rechaza horario base con startTime >= endTime", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ staffId: "s-1", type: "base_schedule", schedule: { weekday: 1, startTime: "18:00", endTime: "08:00" } })
    ).rejects.toBeInstanceOf(InvalidAvailabilityRangeError);
  });

  test("rechaza ausencia con startAt >= endAt", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ staffId: "s-1", type: "planned_absence", range: { startAt: "2026-08-05T00:00:00Z", endAt: "2026-08-01T00:00:00Z" } })
    ).rejects.toBeInstanceOf(InvalidAvailabilityRangeError);
  });

  test("rechaza horario base que se superpone con uno ya existente (excepción documentada, protección solo en aplicación)", async () => {
    const { execute } = buildUseCase([
      { id: "a1", staffId: "s-1", type: "base_schedule", weekday: 1, startTime: "08:00", endTime: "12:00" },
    ]);
    await expect(
      execute({ staffId: "s-1", type: "base_schedule", schedule: { weekday: 1, startTime: "11:00", endTime: "13:00" } })
    ).rejects.toBeInstanceOf(InvalidAvailabilityRangeError);
  });

  test("rechaza type inválido", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "s-1", type: "weird" })).rejects.toBeInstanceOf(InvalidAvailabilityRangeError);
  });
});
