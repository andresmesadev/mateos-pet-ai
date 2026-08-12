const { createGetServiceCategoryUseCase } = require("../application/use-cases/get-service-category.usecase");
const { ServiceNotFoundError } = require("../domain/errors");

function buildDeps({ service, category } = {}) {
  const serviceRepository = { findById: jest.fn().mockResolvedValue(service ?? null) };
  const serviceCategoryReader = { findById: jest.fn().mockResolvedValue(category ?? null) };
  return { serviceRepository, serviceCategoryReader };
}

describe("GetServiceCategoryUseCase", () => {
  test("rechaza un serviceId inexistente", async () => {
    const deps = buildDeps({ service: null });
    const execute = createGetServiceCategoryUseCase(deps);
    await expect(execute({ serviceId: "no-existe", tenantId: "t1" })).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  test("rechaza un servicio de otro tenant como si no existiera", async () => {
    const deps = buildDeps({ service: { id: "svc-1", tenantId: "tenant-b", categoryId: "cat-1" } });
    const execute = createGetServiceCategoryUseCase(deps);
    await expect(execute({ serviceId: "svc-1", tenantId: "tenant-a" })).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  test("resuelve el nombre de categoría del servicio dentro del mismo tenant", async () => {
    const deps = buildDeps({
      service: { id: "svc-1", tenantId: "tenant-a", categoryId: "cat-1" },
      category: { id: "cat-1", name: "veterinary" },
    });
    const execute = createGetServiceCategoryUseCase(deps);
    const result = await execute({ serviceId: "svc-1", tenantId: "tenant-a" });
    expect(result).toEqual({ categoryName: "veterinary" });
  });

  test("sin tenantId (uso interno) no filtra por tenant", async () => {
    const deps = buildDeps({
      service: { id: "svc-1", tenantId: "tenant-a", categoryId: "cat-1" },
      category: { id: "cat-1", name: "grooming" },
    });
    const execute = createGetServiceCategoryUseCase(deps);
    const result = await execute({ serviceId: "svc-1" });
    expect(result).toEqual({ categoryName: "grooming" });
  });
});
