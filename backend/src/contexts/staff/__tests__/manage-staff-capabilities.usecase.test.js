const { createManageStaffCapabilitiesUseCase } = require("../application/use-cases/manage-staff-capabilities.usecase");
const {
  createFakeStaffRepository,
  createFakeStaffCapabilityRepository,
  createFakeServiceExistenceReader,
  createFakeEventPublisher,
} = require("./fakes");
const { StaffNotFoundError, ReferencedServiceNotFoundError, DuplicateStaffCapabilityError } = require("../domain/errors");

function buildUseCase({ existingCapabilities = [], existingServiceIds = ["svc-1", "svc-2"] } = {}) {
  const staffRepository = createFakeStaffRepository([{ id: "s-1", tenantId: "t1", name: "Lina", active: true }]);
  const staffCapabilityRepository = createFakeStaffCapabilityRepository(existingCapabilities);
  const serviceExistenceReader = createFakeServiceExistenceReader(existingServiceIds);
  const eventPublisher = createFakeEventPublisher();
  const execute = createManageStaffCapabilitiesUseCase({
    staffRepository,
    staffCapabilityRepository,
    serviceExistenceReader,
    eventPublisher,
  });
  return { execute, staffCapabilityRepository, eventPublisher };
}

describe("ManageStaffCapabilitiesUseCase", () => {
  test("agrega capacidades nuevas y emite CapacidadAsignada por cada una", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { capabilities, added, removed } = await execute({ staffId: "s-1", serviceIds: ["svc-1", "svc-2"] });
    expect(capabilities).toHaveLength(2);
    expect(added.sort()).toEqual(["svc-1", "svc-2"]);
    expect(removed).toEqual([]);
    const asignadas = eventPublisher.events.filter((e) => e.eventName === "CapacidadAsignada");
    expect(asignadas).toHaveLength(2);
    // Entregable 5.2 — Certificación Real de Eventos por Contexto: tenantId debe
    // viajar en el payload para que pueda certificarse como Evento de Dominio.
    expect(asignadas.every((e) => e.payload.tenantId === "t1")).toBe(true);
  });

  test("retira capacidades que ya no están en el conjunto solicitado", async () => {
    const { execute, eventPublisher } = buildUseCase({
      existingCapabilities: [{ id: "c1", staffId: "s-1", serviceId: "svc-1", active: true }],
    });
    const { added, removed } = await execute({ staffId: "s-1", serviceIds: ["svc-2"] });
    expect(added).toEqual(["svc-2"]);
    expect(removed).toEqual(["svc-1"]);
    const revocada = eventPublisher.events.find((e) => e.eventName === "CapacidadRevocada");
    expect(revocada).toBeDefined();
    expect(revocada.payload.tenantId).toBe("t1");
  });

  test("rechaza si el staff no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "no-existe", serviceIds: [] })).rejects.toBeInstanceOf(StaffNotFoundError);
  });

  test("rechaza si algún servicio referenciado no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "s-1", serviceIds: ["svc-fantasma"] })).rejects.toBeInstanceOf(
      ReferencedServiceNotFoundError
    );
  });

  test("traduce la violación del índice único parcial a DuplicateStaffCapabilityError (protección de carrera)", async () => {
    const { execute, staffCapabilityRepository } = buildUseCase();
    staffCapabilityRepository.create = async () => {
      const err = new Error("duplicate");
      err.code = "UNIQUE_STAFF_CAPABILITY_VIOLATION";
      throw err;
    };
    await expect(execute({ staffId: "s-1", serviceIds: ["svc-1"] })).rejects.toBeInstanceOf(DuplicateStaffCapabilityError);
  });

  test("Entregable 6.3 — rechaza como StaffNotFoundError si el staff pertenece a otro tenant", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ staffId: "s-1", serviceIds: ["svc-1"], tenantId: "t2" })).rejects.toBeInstanceOf(StaffNotFoundError);
  });
});
