const { createResolveServicePriceUseCase } = require("../application/use-cases/resolve-service-price.usecase");
const { createFakeServiceRepository, createFakePriceRuleRepository, createFakeTargetExistenceReader } = require("./fakes");
const { ServiceNotFoundError, ServiceInactiveError } = require("../domain/errors");

function buildUseCase({ services, rules = [], pets = [] } = {}) {
  const serviceRepository = createFakeServiceRepository(
    services || [{ id: "s-1", tenantId: "t1", categoryId: "cat-1", name: "Baño", basePrice: 30000, active: true }]
  );
  const priceRuleRepository = createFakePriceRuleRepository(rules);
  const targetExistenceReader = createFakeTargetExistenceReader({ pets });
  const execute = createResolveServicePriceUseCase({ serviceRepository, priceRuleRepository, targetExistenceReader });
  return { execute };
}

describe("ResolveServicePriceUseCase", () => {
  test("resuelve al precio base cuando no hay reglas aplicables", async () => {
    const { execute } = buildUseCase();
    const result = await execute({ serviceId: "s-1" });
    expect(result.finalPrice).toBe(30000);
    expect(result.source).toBe("service_base_price");
  });

  test("resuelve al precio acordado por mascota cuando existe", async () => {
    const { execute } = buildUseCase({
      rules: [{ id: "r1", serviceId: "s-1", targetType: "pet", targetId: "pet-1", price: 18000, active: true }],
      pets: [{ id: "pet-1" }],
    });
    const result = await execute({ serviceId: "s-1", petId: "pet-1" });
    expect(result.finalPrice).toBe(18000);
    expect(result.source).toBe("pet_agreed_price");
  });

  test("usa los atributos de la mascota (raza) cuando no hay regla más específica", async () => {
    const { execute } = buildUseCase({
      rules: [{ id: "r1", serviceId: "s-1", targetType: "breed", targetId: "labrador", price: 22000, active: true }],
      pets: [{ id: "pet-1", breedId: "labrador" }],
    });
    const result = await execute({ serviceId: "s-1", petId: "pet-1" });
    expect(result.finalPrice).toBe(22000);
    expect(result.source).toBe("breed_price");
  });

  test("rechaza si el servicio no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ serviceId: "no-existe" })).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  test("rechaza resolver precio sobre un servicio inactivo", async () => {
    const { execute } = buildUseCase({
      services: [{ id: "s-1", tenantId: "t1", categoryId: "cat-1", name: "Baño", basePrice: 30000, active: false }],
    });
    await expect(execute({ serviceId: "s-1" })).rejects.toBeInstanceOf(ServiceInactiveError);
  });

  test("no produce eventos de dominio (es una consulta de lectura pura)", async () => {
    const { execute } = buildUseCase();
    const result = await execute({ serviceId: "s-1" });
    expect(result).not.toHaveProperty("events");
  });
});
