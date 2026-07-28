const { createResolveStaffAvailabilityUseCase } = require("../application/use-cases/resolve-staff-availability.usecase");
const {
  createFakeStaffRepository,
  createFakeStaffCapabilityRepository,
  createFakeAvailabilityRepository,
  createFakeServiceExistenceReader,
} = require("./fakes");
const { ReferencedServiceNotFoundError } = require("../domain/errors");

// 2026-07-14 es martes → weekday 2
function buildUseCase() {
  const staffRepository = createFakeStaffRepository([
    { id: "s-1", tenantId: "t1", name: "Lina", active: true },
    { id: "s-2", tenantId: "t1", name: "Andrés", active: true },
    { id: "s-3", tenantId: "t1", name: "Inactivo", active: false },
    { id: "s-4", tenantId: "t2", name: "De otro establecimiento", active: true },
  ]);
  const staffCapabilityRepository = createFakeStaffCapabilityRepository([
    { id: "c1", staffId: "s-1", serviceId: "svc-1", active: true },
    { id: "c2", staffId: "s-2", serviceId: "svc-1", active: true },
    { id: "c3", staffId: "s-3", serviceId: "svc-1", active: true },
    { id: "c4", staffId: "s-4", serviceId: "svc-1", active: true },
  ]);
  const availabilityRepository = createFakeAvailabilityRepository([
    { id: "a1", staffId: "s-1", type: "base_schedule", weekday: 2, startTime: "08:00", endTime: "18:00" },
    { id: "a2", staffId: "s-2", type: "base_schedule", weekday: 2, startTime: "08:00", endTime: "18:00" },
    { id: "a4", staffId: "s-4", type: "base_schedule", weekday: 2, startTime: "08:00", endTime: "18:00" },
    {
      id: "a3",
      staffId: "s-2",
      type: "unplanned_absence",
      startAt: new Date("2026-07-14T09:00:00Z"),
      endAt: new Date("2026-07-14T11:00:00Z"),
    },
  ]);
  const serviceExistenceReader = createFakeServiceExistenceReader(["svc-1"]);
  const execute = createResolveStaffAvailabilityUseCase({
    staffRepository,
    staffCapabilityRepository,
    availabilityRepository,
    serviceExistenceReader,
  });
  return { execute };
}

describe("ResolveStaffAvailabilityUseCase", () => {
  test("retorna solo el staff con capacidad, horario y sin ausencia en el rango", async () => {
    const { execute } = buildUseCase();
    const { availableStaff } = await execute({
      serviceId: "svc-1",
      rangeStart: "2026-07-14T09:00:00Z",
      rangeEnd: "2026-07-14T10:00:00Z",
      tenantId: "t1",
    });
    expect(availableStaff.map((s) => s.id)).toEqual(["s-1"]);
  });

  test("excluye al staff inactivo aunque tenga capacidad y horario", async () => {
    const { execute } = buildUseCase();
    const { availableStaff } = await execute({
      serviceId: "svc-1",
      rangeStart: "2026-07-14T12:00:00Z",
      rangeEnd: "2026-07-14T13:00:00Z",
      tenantId: "t1",
    });
    expect(availableStaff.find((s) => s.id === "s-3")).toBeUndefined();
  });

  test("incluye a quien no tiene ausencia en el rango solicitado", async () => {
    const { execute } = buildUseCase();
    const { availableStaff } = await execute({
      serviceId: "svc-1",
      rangeStart: "2026-07-14T14:00:00Z",
      rangeEnd: "2026-07-14T15:00:00Z",
      tenantId: "t1",
    });
    expect(availableStaff.map((s) => s.id).sort()).toEqual(["s-1", "s-2"]);
  });

  test("Entregable 6.3 — excluye staff de otro establecimiento aunque cumpla capacidad y horario", async () => {
    const { execute } = buildUseCase();
    const { availableStaff } = await execute({
      serviceId: "svc-1",
      rangeStart: "2026-07-14T09:00:00Z",
      rangeEnd: "2026-07-14T10:00:00Z",
      tenantId: "t1",
    });
    expect(availableStaff.find((s) => s.id === "s-4")).toBeUndefined();
  });

  test("Entregable 6.3 — sin tenantId, no filtra por establecimiento (comportamiento legado)", async () => {
    const { execute } = buildUseCase();
    const { availableStaff } = await execute({
      serviceId: "svc-1",
      rangeStart: "2026-07-14T09:00:00Z",
      rangeEnd: "2026-07-14T10:00:00Z",
    });
    expect(availableStaff.map((s) => s.id).sort()).toEqual(["s-1", "s-4"]);
  });

  test("rechaza si el servicio no existe", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ serviceId: "svc-fantasma", rangeStart: "2026-07-14T09:00:00Z", rangeEnd: "2026-07-14T10:00:00Z" })
    ).rejects.toBeInstanceOf(ReferencedServiceNotFoundError);
  });
});
