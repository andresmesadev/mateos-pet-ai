const { createUpdateStaffUseCase } = require("../application/use-cases/update-staff.usecase");
const { createFakeStaffRepository, createFakeEventPublisher } = require("./fakes");
const { StaffNotFoundError, InvalidStaffAttributesError } = require("../domain/errors");

function buildUseCase(initial) {
  const staffRepository = createFakeStaffRepository(
    initial || [{ id: "s-1", tenantId: "t1", name: "Lina", role: "groomer", active: true, generatesCommission: true }]
  );
  const eventPublisher = createFakeEventPublisher();
  const execute = createUpdateStaffUseCase({ staffRepository, eventPublisher });
  return { execute, eventPublisher };
}

describe("UpdateStaffUseCase", () => {
  test('updates contractual terms without changing role, schedule or prior records', async () => {
    const { execute } = buildUseCase();
    const { staff } = await execute({ tenantId: 't1', staffId: 's-1', contractType: 'service', commissionRate: 0.3 });
    expect(staff).toMatchObject({ role: 'groomer', contractType: 'service', commissionRate: 0.3, name: 'Lina' });
    const fixed = await execute({ tenantId: 't1', staffId: 's-1', contractType: 'fixed', commissionRate: null });
    expect(fixed.staff).toMatchObject({ contractType: 'fixed', commissionRate: null });
    await expect(execute({ tenantId: 't2', staffId: 's-1', contractType: 'service', commissionRate: 1 })).rejects.toBeInstanceOf(StaffNotFoundError);
    await expect(execute({ tenantId: 't1', staffId: 's-1', contractType: 'service', commissionRate: 2 })).rejects.toBeInstanceOf(InvalidStaffAttributesError);
  });
  test("actualiza atributos y emite StaffActualizado", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { staff } = await execute({ staffId: "s-1", name: "Lina María" });
    expect(staff.name).toBe("Lina María");
    expect(eventPublisher.events[0].eventName).toBe("StaffActualizado");
  });

  test("rechaza si el miembro no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "no-existe", name: "x" })).rejects.toBeInstanceOf(StaffNotFoundError);
  });

  test("rechaza rol inválido", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "s-1", role: "manager" })).rejects.toBeInstanceOf(InvalidStaffAttributesError);
  });

  test("permite cambiar generatesCommission sin tocar otros campos", async () => {
    const { execute } = buildUseCase();
    const { staff } = await execute({ staffId: "s-1", generatesCommission: false });
    expect(staff.generatesCommission).toBe(false);
    expect(staff.name).toBe("Lina");
  });

  test("Entregable 6.3 — rechaza como StaffNotFoundError si el staff pertenece a otro tenant", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "s-1", name: "Otro", tenantId: "t2" })).rejects.toBeInstanceOf(StaffNotFoundError);
  });
});
