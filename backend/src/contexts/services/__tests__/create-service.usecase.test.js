const { createCreateServiceUseCase } = require("../application/use-cases/create-service.usecase");
const {
  createFakeServiceRepository,
  createFakeServiceCategoryReader,
  createFakeBusinessConfigReader,
  createFakeEventPublisher,
} = require("./fakes");
const {
  ServiceCategoryNotEnabledError,
  DuplicateServiceNameError,
  InvalidServiceAttributesError,
} = require("../domain/errors");

const GROOMING_CATEGORY = { id: "cat-grooming", name: "grooming", active: true };

function buildUseCase({ activeModules = ["grooming"], categories = [GROOMING_CATEGORY], existingServices = [] } = {}) {
  const serviceRepository = createFakeServiceRepository(existingServices);
  const serviceCategoryReader = createFakeServiceCategoryReader(categories);
  const businessConfigReader = createFakeBusinessConfigReader(activeModules);
  const eventPublisher = createFakeEventPublisher();
  const execute = createCreateServiceUseCase({ serviceRepository, serviceCategoryReader, businessConfigReader, eventPublisher });
  return { execute, serviceRepository, eventPublisher };
}

describe("CreateServiceUseCase", () => {
  test("crea el servicio y emite ServicioCreado", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { service } = await execute({
      tenantId: "tenant-1",
      name: "Baño y corte",
      categoryId: "cat-grooming",
      duration: 60,
      basePrice: 50000,
    });

    expect(service.active).toBe(true);
    expect(service.name).toBe("Baño y corte");
    expect(eventPublisher.events).toHaveLength(1);
    expect(eventPublisher.events[0].eventName).toBe("ServicioCreado");
  });

  test("rechaza duración inválida", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ tenantId: "t1", name: "x", categoryId: "cat-grooming", duration: 0, basePrice: 10 })
    ).rejects.toBeInstanceOf(InvalidServiceAttributesError);
  });

  test("rechaza precio base negativo o nulo", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ tenantId: "t1", name: "x", categoryId: "cat-grooming", duration: 30, basePrice: -1 })
    ).rejects.toBeInstanceOf(InvalidServiceAttributesError);
  });

  test("rechaza si la categoría no está habilitada por los módulos activos", async () => {
    const { execute } = buildUseCase({ activeModules: [] });
    await expect(
      execute({ tenantId: "t1", name: "x", categoryId: "cat-grooming", duration: 30, basePrice: 10 })
    ).rejects.toBeInstanceOf(ServiceCategoryNotEnabledError);
  });

  test("rechaza nombre duplicado activo en la misma categoría", async () => {
    const existing = { id: "s-1", tenantId: "t1", categoryId: "cat-grooming", name: "Baño", active: true };
    const { execute } = buildUseCase({ existingServices: [existing] });
    await expect(
      execute({ tenantId: "t1", name: "Baño", categoryId: "cat-grooming", duration: 30, basePrice: 10 })
    ).rejects.toBeInstanceOf(DuplicateServiceNameError);
  });
});
