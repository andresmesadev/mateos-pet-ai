const { createReactivateStaffUseCase } = require("../application/use-cases/reactivate-staff.usecase");
const { createFakeStaffRepository, createFakeStaffCapabilityRepository, createFakeEventPublisher } = require("./fakes");
const { StaffNotFoundError, StaffAlreadyActiveError } = require("../domain/errors");

function buildUseCase() {
  const staffRepository = createFakeStaffRepository([
    { id: "s-1", tenantId: "t1", name: "Lina", role: "groomer", active: false },
    { id: "s-2", tenantId: "t1", name: "Andrés", role: "admin", active: true },
  ]);
  const staffCapabilityRepository = createFakeStaffCapabilityRepository([
    { id: "cap-1", staffId: "s-1", serviceId: "svc-1", active: true },
  ]);
  const eventPublisher = createFakeEventPublisher();
  const execute = createReactivateStaffUseCase({ staffRepository, staffCapabilityRepository, eventPublisher });
  return { execute, staffCapabilityRepository, eventPublisher };
}

describe("ReactivateStaffUseCase", () => {
  test("reactiva y reporta las capacidades vigentes, sin escribir sobre StaffCapability", async () => {
    const { execute, staffCapabilityRepository, eventPublisher } = buildUseCase();
    const rowsBefore = staffCapabilityRepository.rows.length;

    const { staff, restoredCapabilities } = await execute({ staffId: "s-1" });

    expect(staff.active).toBe(true);
    expect(restoredCapabilities).toHaveLength(1);
    expect(restoredCapabilities[0].serviceId).toBe("svc-1");
    expect(staffCapabilityRepository.rows.length).toBe(rowsBefore); // sin mutación
    expect(eventPublisher.events[0].eventName).toBe("StaffReactivado");
  });

  test("rechaza si no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "no-existe" })).rejects.toBeInstanceOf(StaffNotFoundError);
  });

  test("rechaza si ya está activo", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "s-2" })).rejects.toBeInstanceOf(StaffAlreadyActiveError);
  });

  test("Entregable 6.3 — rechaza como StaffNotFoundError si el staff pertenece a otro tenant", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "s-1", tenantId: "t2" })).rejects.toBeInstanceOf(StaffNotFoundError);
  });
});
