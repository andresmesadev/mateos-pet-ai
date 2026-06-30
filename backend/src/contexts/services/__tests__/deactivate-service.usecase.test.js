const { createDeactivateServiceUseCase } = require("../application/use-cases/deactivate-service.usecase");
const { createFakeServiceRepository, createFakeEventPublisher } = require("./fakes");
const { ServiceNotFoundError, ServiceAlreadyInactiveError } = require("../domain/errors");

function buildUseCase(existingServices) {
  const serviceRepository = createFakeServiceRepository(
    existingServices || [
      { id: "s-1", tenantId: "t1", categoryId: "cat-1", name: "Baño", active: true },
      { id: "s-2", tenantId: "t1", categoryId: "cat-1", name: "Corte", active: false },
    ]
  );
  const eventPublisher = createFakeEventPublisher();
  const execute = createDeactivateServiceUseCase({ serviceRepository, eventPublisher });
  return { execute, eventPublisher };
}

describe("DeactivateServiceUseCase", () => {
  test("desactiva un servicio activo y emite ServicioDesactivado", async () => {
    const { execute, eventPublisher } = buildUseCase();
    const { service } = await execute({ serviceId: "s-1" });
    expect(service.active).toBe(false);
    expect(eventPublisher.events[0].eventName).toBe("ServicioDesactivado");
  });

  test("rechaza si el servicio no existe", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ serviceId: "no-existe" })).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  test("rechaza si el servicio ya está inactivo", async () => {
    const { execute } = buildUseCase();
    await expect(execute({ serviceId: "s-2" })).rejects.toBeInstanceOf(ServiceAlreadyInactiveError);
  });
});
