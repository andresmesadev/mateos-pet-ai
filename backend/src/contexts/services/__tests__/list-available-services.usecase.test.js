const { createListAvailableServicesUseCase } = require("../application/use-cases/list-available-services.usecase");
const { createFakeServiceRepository, createFakeServiceCategoryReader, createFakeBusinessConfigReader } = require("./fakes");

const SERVICES = [
  { id: "s-1", tenantId: "t1", categoryId: "cat-grooming", name: "Baño", active: true },
  { id: "s-2", tenantId: "t1", categoryId: "cat-grooming", name: "Corte", active: false },
  { id: "s-3", tenantId: "t1", categoryId: "cat-vet", name: "Consulta", active: true },
  { id: "s-4", tenantId: "t2", categoryId: "cat-grooming", name: "Baño otro tenant", active: true },
];

const CATEGORIES = [
  { id: "cat-grooming", name: "grooming", active: true },
  { id: "cat-vet", name: "veterinary", active: true },
];

function buildUseCase({ activeModules = ["grooming", "veterinary"] } = {}) {
  const serviceRepository = createFakeServiceRepository(SERVICES);
  const serviceCategoryReader = createFakeServiceCategoryReader(CATEGORIES);
  const businessConfigReader = createFakeBusinessConfigReader(activeModules);
  return createListAvailableServicesUseCase({ serviceRepository, serviceCategoryReader, businessConfigReader });
}

describe("ListAvailableServicesUseCase", () => {
  test("por defecto retorna solo servicios activos del establecimiento", async () => {
    const execute = buildUseCase();
    const { services } = await execute({ tenantId: "t1" });
    expect(services.map((s) => s.id).sort()).toEqual(["s-1", "s-3"]);
  });

  test("filtra por categoría", async () => {
    const execute = buildUseCase();
    const { services } = await execute({ tenantId: "t1", categoryId: "cat-grooming" });
    expect(services.map((s) => s.id)).toEqual(["s-1"]);
  });

  test("incluye inactivos solo si se solicita explícitamente", async () => {
    const execute = buildUseCase();
    const { services } = await execute({ tenantId: "t1", includeInactive: true });
    expect(services.map((s) => s.id).sort()).toEqual(["s-1", "s-2", "s-3"]);
  });

  test("no mezcla servicios de otro establecimiento", async () => {
    const execute = buildUseCase();
    const { services } = await execute({ tenantId: "t1" });
    expect(services.find((s) => s.id === "s-4")).toBeUndefined();
  });

  test("excluye servicios cuya categoría ya no está habilitada por los módulos activos", async () => {
    const execute = buildUseCase({ activeModules: ["veterinary"] }); // grooming desactivado
    const { services } = await execute({ tenantId: "t1", includeInactive: true });
    expect(services.map((s) => s.id)).toEqual(["s-3"]);
  });
});
