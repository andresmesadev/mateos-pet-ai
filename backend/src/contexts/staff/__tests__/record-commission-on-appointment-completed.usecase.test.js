const {
  createRecordCommissionOnAppointmentCompletedUseCase,
} = require("../application/use-cases/record-commission-on-appointment-completed.usecase");
const {
  createFakeStaffRepository,
  createFakeCommissionRepository,
  createFakeServiceCategoryReader,
  createFakeBusinessConfigReader,
  createFakeEventPublisher,
} = require("./fakes");
const { StaffNotFoundError, ReferencedServiceNotFoundError, InvalidCommissionInputError } = require("../domain/errors");

function buildUseCase({ splitRate = 0.5, staffAttributes = {} } = {}) {
  const staffRepository = createFakeStaffRepository([{ id: "s-1", tenantId: "t1", name: "Lina", active: true, ...staffAttributes }]);
  const commissionRepository = createFakeCommissionRepository();
  const serviceCategoryReader = createFakeServiceCategoryReader({
    "svc-grooming": { id: "cat-grooming", name: "grooming", appliesCommissionSplit: true },
    "svc-vet": { id: "cat-vet", name: "veterinary", appliesCommissionSplit: false },
  });
  const businessConfigReader = createFakeBusinessConfigReader({ splitRate });
  const eventPublisher = createFakeEventPublisher();
  const execute = createRecordCommissionOnAppointmentCompletedUseCase({
    staffRepository,
    commissionRepository,
    serviceCategoryReader,
    businessConfigReader,
    eventPublisher,
  });
  return { execute, commissionRepository, eventPublisher };
}

describe("RecordCommissionOnAppointmentCompletedUseCase", () => {
  test.each([['service', 0.3, 'svc-grooming', 15000], ['service', 0.4, 'svc-grooming', 20000], ['fixed', null, 'svc-grooming', 0], ['service', 0.3, 'svc-vet', 0]])('freezes %s/%p on %s into the new commission', async (contractType, commissionRate, serviceId, expected) => {
    const { execute } = buildUseCase({ staffAttributes: { contractType, commissionRate } });
    const { commission } = await execute({ tenantId: 't1', appointmentId: 'new-appt', staffId: 's-1', serviceId, resolvedPrice: 50000 });
    expect(commission.staffShare).toBe(expected);
    expect(commission.businessShare).toBe(50000 - expected);
    expect(commission.splitRate).toBe(expected / 50000);
  });
  test("registra comisión con split cuando la categoría lo aplica (grooming)", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { commission } = await execute({
      tenantId: "t1",
      appointmentId: "appt-1",
      staffId: "s-1",
      serviceId: "svc-grooming",
      resolvedPrice: 50000,
    });
    expect(commission.staffShare).toBe(25000);
    expect(commission.businessShare).toBe(25000);
    expect(commission.serviceCategory).toBe("grooming");
    expect(eventPublisher.events[0].eventName).toBe("ComisiónRegistrada");
  });

  test("registra comisión sin split cuando la categoría no lo aplica (veterinaria)", async () => {
    const { execute } = buildUseCase();
    const { commission } = await execute({
      appointmentId: "appt-2",
      staffId: "s-1",
      serviceId: "svc-vet",
      resolvedPrice: 80000,
    });
    expect(commission.staffShare).toBe(0);
    expect(commission.businessShare).toBe(80000);
  });

  test("rechaza si el staff no existe", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ appointmentId: "a", staffId: "no-existe", serviceId: "svc-grooming", resolvedPrice: 1000 })
    ).rejects.toBeInstanceOf(StaffNotFoundError);
  });

  test("rechaza si el servicio referenciado no existe", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ appointmentId: "a", staffId: "s-1", serviceId: "svc-fantasma", resolvedPrice: 1000 })
    ).rejects.toBeInstanceOf(ReferencedServiceNotFoundError);
  });

  test("rechaza precio nulo o negativo", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ appointmentId: "a", staffId: "s-1", serviceId: "svc-grooming", resolvedPrice: -1 })
    ).rejects.toBeInstanceOf(InvalidCommissionInputError);
  });

  test("rechaza si faltan datos obligatorios del evento", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ appointmentId: "a", staffId: "s-1", serviceId: null, resolvedPrice: 1000 })
    ).rejects.toBeInstanceOf(InvalidCommissionInputError);
  });

  test("Entregable 6.3 — rechaza como StaffNotFoundError si el staff pertenece a otro tenant", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({
        tenantId: "t2",
        appointmentId: "a",
        staffId: "s-1",
        serviceId: "svc-grooming",
        resolvedPrice: 1000,
      })
    ).rejects.toBeInstanceOf(StaffNotFoundError);
  });
});
