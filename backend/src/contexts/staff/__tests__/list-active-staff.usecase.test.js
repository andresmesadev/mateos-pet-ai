const { createListActiveStaffUseCase } = require("../application/use-cases/list-active-staff.usecase");
const { createFakeStaffRepository, createFakeStaffCapabilityRepository } = require("./fakes");

function buildUseCase() {
  const staffRepository = createFakeStaffRepository([
    { id: "s-1", tenantId: "t1", name: "Lina", role: "groomer", active: true },
    { id: "s-2", tenantId: "t1", name: "Andrés", role: "admin", active: false },
    { id: "s-3", tenantId: "t1", name: "Carlos", role: "vet", active: true },
  ]);
  const staffCapabilityRepository = createFakeStaffCapabilityRepository([
    { id: "c1", staffId: "s-1", serviceId: "svc-1", active: true },
  ]);
  return createListActiveStaffUseCase({ staffRepository, staffCapabilityRepository });
}

describe("ListActiveStaffUseCase", () => {
  test("por defecto retorna solo staff activo", async () => {
    const execute = buildUseCase();
    const { staff } = await execute({ tenantId: "t1" });
    expect(staff.map((s) => s.id).sort()).toEqual(["s-1", "s-3"]);
  });

  test("filtra por rol", async () => {
    const execute = buildUseCase();
    const { staff } = await execute({ tenantId: "t1", role: "vet" });
    expect(staff.map((s) => s.id)).toEqual(["s-3"]);
  });

  test("filtra por capacidad de servicio", async () => {
    const execute = buildUseCase();
    const { staff } = await execute({ tenantId: "t1", serviceId: "svc-1" });
    expect(staff.map((s) => s.id)).toEqual(["s-1"]);
  });

  test("incluye inactivos solo si se solicita explícitamente", async () => {
    const execute = buildUseCase();
    const { staff } = await execute({ tenantId: "t1", includeInactive: true });
    expect(staff.map((s) => s.id).sort()).toEqual(["s-1", "s-2", "s-3"]);
  });

  test("adjunta las capacidades vigentes de cada miembro (corrección de fidelidad al contrato)", async () => {
    const execute = buildUseCase();
    const { staff } = await execute({ tenantId: "t1" });
    const lina = staff.find((s) => s.id === "s-1");
    const carlos = staff.find((s) => s.id === "s-3");
    expect(lina.capabilities.map((c) => c.serviceId)).toEqual(["svc-1"]);
    expect(carlos.capabilities).toEqual([]);
  });
});
