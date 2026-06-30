const { createRegisterStaffUseCase } = require("../application/use-cases/register-staff.usecase");
const { createFakeStaffRepository, createFakeEventPublisher } = require("./fakes");
const { InvalidStaffAttributesError } = require("../domain/errors");

function buildUseCase() {
  const staffRepository = createFakeStaffRepository();
  const eventPublisher = createFakeEventPublisher();
  const execute = createRegisterStaffUseCase({ staffRepository, eventPublisher });
  return { execute, eventPublisher };
}

describe("RegisterStaffUseCase", () => {
  test("crea el miembro activo y emite StaffRegistrado", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { staff } = await execute({ tenantId: "t1", name: "Lina", role: "groomer" });
    expect(staff.active).toBe(true);
    expect(eventPublisher.events[0].eventName).toBe("StaffRegistrado");
  });

  test("deriva generatesCommission del rol cuando no se provee", async () => {
    const { execute } = buildUseCase();
    const { staff: groomer } = await execute({ tenantId: "t1", name: "A", role: "groomer" });
    const { staff: admin } = await execute({ tenantId: "t1", name: "B", role: "admin" });
    expect(groomer.generatesCommission).toBe(true);
    expect(admin.generatesCommission).toBe(false);
  });

  test("respeta generatesCommission explícito sobre el default del rol", async () => {
    const { execute } = buildUseCase();
    const { staff } = await execute({ tenantId: "t1", name: "C", role: "admin", generatesCommission: true });
    expect(staff.generatesCommission).toBe(true);
  });

  test("rechaza nombre vacío", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", name: "  ", role: "vet" })).rejects.toBeInstanceOf(InvalidStaffAttributesError);
  });

  test("rechaza rol inválido", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", name: "X", role: "manager" })).rejects.toBeInstanceOf(InvalidStaffAttributesError);
  });
});
