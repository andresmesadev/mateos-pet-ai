const { createChangeServicePriceUseCase } = require("../application/use-cases/change-service-price.usecase");
const { createFakeServiceRepository, createFakePriceRuleRepository, createFakeTargetExistenceReader, createFakeEventPublisher } = require("./fakes");
const { ServiceNotFoundError, InvalidPriceError, PriceRuleTargetNotFoundError, DuplicatePriceRuleError } = require("../domain/errors");

function buildUseCase({ services, rules = [], clients = ["client-1"], pets = [{ id: "pet-1" }] } = {}) {
  const serviceRepository = createFakeServiceRepository(
    services || [{ id: "s-1", tenantId: "t1", categoryId: "cat-1", name: "Baño", basePrice: 30000, active: true }]
  );
  const priceRuleRepository = createFakePriceRuleRepository(rules);
  const targetExistenceReader = createFakeTargetExistenceReader({ clients, pets });
  const eventPublisher = createFakeEventPublisher();
  const execute = createChangeServicePriceUseCase({ serviceRepository, priceRuleRepository, targetExistenceReader, eventPublisher });
  return { execute, serviceRepository, priceRuleRepository, eventPublisher };
}

describe("ChangeServicePriceUseCase", () => {
  test("cambia el precio base del catálogo (target.type = base)", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { service, appliedRule } = await execute({ serviceId: "s-1", target: { type: "base" }, newPrice: 35000 });
    expect(service.basePrice).toBe(35000);
    expect(appliedRule).toBeNull();
    expect(eventPublisher.events[0].eventName).toBe("ServicioActualizado");
  });

  test("crea una regla de precio acordada por cliente", async () => {
    const { execute, priceRuleRepository } = buildUseCase();
    const { appliedRule } = await execute({
      serviceId: "s-1",
      target: { type: "client", clientId: "client-1" },
      newPrice: 25000,
    });
    expect(appliedRule.targetType).toBe("client");
    expect(appliedRule.price).toBe(25000);
    expect(priceRuleRepository.rules).toHaveLength(1);
  });

  test("actualiza (no duplica) una regla ya existente para el mismo destino", async () => {
    const existingRule = { id: "rule-1", serviceId: "s-1", targetType: "pet", targetId: "pet-1", price: 20000, active: true };
    const { execute, priceRuleRepository } = buildUseCase({ rules: [existingRule] });
    const { appliedRule } = await execute({ serviceId: "s-1", target: { type: "pet", petId: "pet-1" }, newPrice: 22000 });
    expect(appliedRule.id).toBe("rule-1");
    expect(appliedRule.price).toBe(22000);
    expect(priceRuleRepository.rules).toHaveLength(1); // no se duplicó
  });

  test("rechaza precio negativo o nulo", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ serviceId: "s-1", target: { type: "base" }, newPrice: -1 })).rejects.toBeInstanceOf(InvalidPriceError);
  });

  test("rechaza si el servicio no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ serviceId: "no-existe", target: { type: "base" }, newPrice: 1 })).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  test("rechaza si el cliente referenciado no existe", async () => {
    const { execute } = buildUseCase({ clients: [] });
    await expect(
      execute({ serviceId: "s-1", target: { type: "client", clientId: "client-fantasma" }, newPrice: 1000 })
    ).rejects.toBeInstanceOf(PriceRuleTargetNotFoundError);
  });

  test("rechaza si la mascota referenciada no existe", async () => {
    const { execute } = buildUseCase({ pets: [] });
    await expect(
      execute({ serviceId: "s-1", target: { type: "pet", petId: "pet-fantasma" }, newPrice: 1000 })
    ).rejects.toBeInstanceOf(PriceRuleTargetNotFoundError);
  });

  test("traduce la violación del índice único parcial a DuplicatePriceRuleError (protección de carrera)", async () => {
    const { execute, priceRuleRepository } = buildUseCase();
    // Simula que otra escritura concurrente ya creó la regla justo después del check de la aplicación.
    const originalFindActiveByTarget = priceRuleRepository.findActiveByTarget;
    priceRuleRepository.findActiveByTarget = async () => null;
    priceRuleRepository.create = async () => {
      const err = new Error("duplicate");
      err.code = "UNIQUE_PRICE_RULE_VIOLATION";
      throw err;
    };

    await expect(
      execute({ serviceId: "s-1", target: { type: "size", size: "L" }, newPrice: 1000 })
    ).rejects.toBeInstanceOf(DuplicatePriceRuleError);

    priceRuleRepository.findActiveByTarget = originalFindActiveByTarget;
  });

  test("rechaza un serviceId de otro tenant cuando se provee tenantId (B3)", async () => {
    const { execute } = buildUseCase();
    await expect(
      execute({ serviceId: "s-1", tenantId: "otro-tenant", target: { type: "base" }, newPrice: 1000 })
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  test("rechaza un cliente de otro tenant aunque exista globalmente (B3)", async () => {
    const { execute } = buildUseCase({ clients: [{ id: "client-1", tenantId: "otro-tenant" }] });
    await expect(
      execute({ serviceId: "s-1", tenantId: "t1", target: { type: "client", clientId: "client-1" }, newPrice: 1000 })
    ).rejects.toBeInstanceOf(PriceRuleTargetNotFoundError);
  });

  test("rechaza una mascota de otro tenant aunque exista globalmente (B3)", async () => {
    const { execute } = buildUseCase({ pets: [{ id: "pet-1", tenantId: "otro-tenant" }] });
    await expect(
      execute({ serviceId: "s-1", tenantId: "t1", target: { type: "pet", petId: "pet-1" }, newPrice: 1000 })
    ).rejects.toBeInstanceOf(PriceRuleTargetNotFoundError);
  });
});
