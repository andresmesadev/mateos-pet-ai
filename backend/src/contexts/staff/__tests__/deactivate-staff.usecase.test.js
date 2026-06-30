const { createDeactivateStaffUseCase } = require("../application/use-cases/deactivate-staff.usecase");
const { createFakeStaffRepository, createFakeEventPublisher } = require("./fakes");
const { StaffNotFoundError, StaffAlreadyInactiveError } = require("../domain/errors");

function buildUseCase() {
  const staffRepository = createFakeStaffRepository([
    { id: "s-1", tenantId: "t1", name: "Lina", role: "groomer", active: true },
    { id: "s-2", tenantId: "t1", name: "Andrés", role: "admin", active: false },
  ]);
  const eventPublisher = createFakeEventPublisher();
  const execute = createDeactivateStaffUseCase({ staffRepository, eventPublisher });
  return { execute, eventPublisher };
}

describe("DeactivateStaffUseCase", () => {
  test("desactiva y emite StaffDesactivado", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { staff } = await execute({ staffId: "s-1" });
    expect(staff.active).toBe(false);
    expect(eventPublisher.events[0].eventName).toBe("StaffDesactivado");
  });

  test("rechaza si no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "no-existe" })).rejects.toBeInstanceOf(StaffNotFoundError);
  });

  test("rechaza si ya está inactivo", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "s-2" })).rejects.toBeInstanceOf(StaffAlreadyInactiveError);
  });
});
