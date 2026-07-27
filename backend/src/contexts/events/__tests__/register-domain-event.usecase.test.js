const { createRegisterDomainEventUseCase } = require("../application/use-cases/register-domain-event.usecase");
const { EventTypeNotFoundError, EventTypeNotActiveError, InvalidDomainEventAttributesError } = require("../domain/errors");

function buildDeps(overrides = {}) {
  const domainEvent = { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" };
  return {
    domainEventRepository: { create: jest.fn().mockResolvedValue(domainEvent) },
    eventTypeRepository: { findByName: jest.fn().mockResolvedValue({ id: "et-1", name: "CitaCompletada", active: true }) },
    eventPublisher: { publish: jest.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
}

describe("registerDomainEvent — reactor genérico (Entregable 5.4)", () => {
  test("sin reactor inyectado, no falla (default no-op)", async () => {
    const execute = createRegisterDomainEventUseCase(buildDeps());
    await expect(
      execute({ tenantId: "t-1", eventTypeName: "CitaCompletada", payload: {}, origin: "Agenda" })
    ).resolves.toEqual({ domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" } });
  });

  test("invoca reactor.notify con domainEvent, eventTypeName y payload tras certificar", async () => {
    const reactor = { notify: jest.fn().mockResolvedValue(undefined) };
    const execute = createRegisterDomainEventUseCase(buildDeps({ reactor }));
    const payload = { tenantId: "t-1", foo: "bar" };
    const ctx = { tx: "fake-tx" };

    await execute({ tenantId: "t-1", eventTypeName: "MensajeEnviado", payload, origin: "Comunicación" }, ctx);

    expect(reactor.notify).toHaveBeenCalledWith(
      { domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" }, eventTypeName: "MensajeEnviado", payload },
      ctx
    );
  });

  test("un reactor que falla nunca rompe la certificación ya persistida", async () => {
    const reactor = { notify: jest.fn().mockRejectedValue(new Error("boom")) };
    const execute = createRegisterDomainEventUseCase(buildDeps({ reactor }));

    await expect(
      execute({ tenantId: "t-1", eventTypeName: "CitaCompletada", payload: {}, origin: "Agenda" })
    ).resolves.toEqual({ domainEvent: { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" } });
  });

  test("el reactor no se invoca si la certificación falla antes (Tipo de Evento inactivo)", async () => {
    const reactor = { notify: jest.fn() };
    const deps = buildDeps({
      reactor,
      eventTypeRepository: { findByName: jest.fn().mockResolvedValue({ id: "et-1", active: false }) },
    });
    const execute = createRegisterDomainEventUseCase(deps);

    await expect(
      execute({ tenantId: "t-1", eventTypeName: "CitaCompletada", payload: {}, origin: "Agenda" })
    ).rejects.toThrow(EventTypeNotActiveError);
    expect(reactor.notify).not.toHaveBeenCalled();
  });

  test("sigue lanzando EventTypeNotFoundError y InvalidDomainEventAttributesError como antes", async () => {
    const execute1 = createRegisterDomainEventUseCase(
      buildDeps({ eventTypeRepository: { findByName: jest.fn().mockResolvedValue(null) } })
    );
    await expect(
      execute1({ tenantId: "t-1", eventTypeName: "NoExiste", payload: {}, origin: "Agenda" })
    ).rejects.toThrow(EventTypeNotFoundError);

    const execute2 = createRegisterDomainEventUseCase(buildDeps());
    await expect(execute2({ eventTypeName: "X", payload: {}, origin: "Agenda" })).rejects.toThrow(
      InvalidDomainEventAttributesError
    );
  });
});
