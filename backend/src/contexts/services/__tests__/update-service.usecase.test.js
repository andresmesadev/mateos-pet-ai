const { createUpdateServiceUseCase } = require("../application/use-cases/update-service.usecase");
const {
  createFakeServiceRepository,
  createFakeServiceCategoryReader,
  createFakeBusinessConfigReader,
  createFakeEventPublisher,
} = require("./fakes");
const { ServiceNotFoundError, ServiceCategoryNotEnabledError, InvalidServiceAttributesError } = require("../domain/errors");

const GROOMING = { id: "cat-grooming", name: "grooming", active: true };
const VET = { id: "cat-vet", name: "veterinary", active: true };

function buildUseCase({ activeModules = ["grooming"], categories = [GROOMING, VET], existingServices } = {}) {
  const serviceRepository = createFakeServiceRepository(
    existingServices || [{ id: "s-1", tenantId: "t1", categoryId: "cat-grooming", name: "Baño", duration: 30, active: true }]
  );
  const serviceCategoryReader = createFakeServiceCategoryReader(categories);
  const businessConfigReader = createFakeBusinessConfigReader(activeModules);
  const eventPublisher = createFakeEventPublisher();
  const execute = createUpdateServiceUseCase({ serviceRepository, serviceCategoryReader, businessConfigReader, eventPublisher });
  return { execute, eventPublisher };
}

describe("UpdateServiceUseCase", () => {
  test("actualiza nombre y duración, emite ServicioActualizado", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { service } = await execute({ tenantId: "t1", serviceId: "s-1", name: "Baño premium", duration: 45 });
    expect(service.name).toBe("Baño premium");
    expect(service.duration).toBe(45);
    expect(eventPublisher.events[0].eventName).toBe("ServicioActualizado");
  });

  test("rechaza si el servicio no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", serviceId: "no-existe", name: "x" })).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  test("rechaza duración inválida", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ tenantId: "t1", serviceId: "s-1", duration: -5 })).rejects.toBeInstanceOf(InvalidServiceAttributesError);
  });

  test("al cambiar de categoría, revalida que la nueva categoría esté habilitada", async () => {
    const { execute } = buildUseCase({ activeModules: ["grooming"] }); // veterinary NO habilitado
    await expect(execute({ tenantId: "t1", serviceId: "s-1", categoryId: "cat-vet" })).rejects.toBeInstanceOf(
      ServiceCategoryNotEnabledError
    );
  });

  test("permite cambiar a una categoría habilitada", async () => {
    const { execute } = buildUseCase({ activeModules: ["grooming", "veterinary"] });
    const { service } = await execute({ tenantId: "t1", serviceId: "s-1", categoryId: "cat-vet" });
    expect(service.categoryId).toBe("cat-vet");
  });
});
