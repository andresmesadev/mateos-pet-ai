/**
 * Entregable 5.2 (Fase 5) — Certificación Real de Eventos por Contexto.
 * Cubre el adaptador reutilizado por los 6 contextos productores: debe
 * certificar cuando puede resolver tenantId, omitir sin fallar cuando no
 * puede resolverlo, y nunca relanzar un fallo de registerDomainEvent.
 */
const { CertifyingDomainEventPublisher, defaultTenantIdExtractor } = require("../certifying-domain-event-publisher");

describe("defaultTenantIdExtractor", () => {
  test("usa tenantId de primer nivel si está presente", () => {
    expect(defaultTenantIdExtractor({ tenantId: "t-1", staffId: "s-1" })).toBe("t-1");
  });

  test("busca tenantId en el primer objeto anidado que lo tenga", () => {
    expect(defaultTenantIdExtractor({ expense: { id: "e-1", tenantId: "t-2" } })).toBe("t-2");
  });

  test("retorna undefined si ningún valor tiene tenantId (entidad global)", () => {
    expect(defaultTenantIdExtractor({ template: { id: "tpl-1" } })).toBeUndefined();
  });

  test("retorna undefined para payload vacío o no-objeto", () => {
    expect(defaultTenantIdExtractor(null)).toBeUndefined();
    expect(defaultTenantIdExtractor(undefined)).toBeUndefined();
  });
});

describe("CertifyingDomainEventPublisher", () => {
  test("certifica cuando puede resolver tenantId", async () => {
    const registerDomainEvent = jest.fn().mockResolvedValue({ domainEvent: { id: "de-1" } });
    const publisher = new CertifyingDomainEventPublisher({ registerDomainEvent, originContext: "Finanzas" });

    await publisher.publish("GastoRegistrado", { expense: { id: "e-1", tenantId: "t-1" } });

    expect(registerDomainEvent).toHaveBeenCalledWith({
      tenantId: "t-1",
      eventTypeName: "GastoRegistrado",
      payload: { expense: { id: "e-1", tenantId: "t-1" } },
      origin: "Finanzas",
      occurredAt: expect.any(Date),
    });
  });

  test("omite sin fallar cuando no puede resolver tenantId (entidad global)", async () => {
    const registerDomainEvent = jest.fn();
    const publisher = new CertifyingDomainEventPublisher({ registerDomainEvent, originContext: "Automatizaciones" });

    await expect(
      publisher.publish("PlantillaDeAutomatizacionRegistrada", { template: { id: "tpl-1" } })
    ).resolves.toBeUndefined();
    expect(registerDomainEvent).not.toHaveBeenCalled();
  });

  test("nunca relanza un fallo de registerDomainEvent (Tipo de Evento inactivo/inexistente)", async () => {
    const registerDomainEvent = jest.fn().mockRejectedValue(new Error("Tipo de Evento no encontrado"));
    const publisher = new CertifyingDomainEventPublisher({ registerDomainEvent, originContext: "Staff" });

    await expect(
      publisher.publish("StaffRegistrado", { staff: { id: "s-1", tenantId: "t-1" } })
    ).resolves.toBeUndefined();
  });

  test("nunca relanza un fallo de infraestructura inesperado", async () => {
    const registerDomainEvent = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const publisher = new CertifyingDomainEventPublisher({ registerDomainEvent, originContext: "Servicios" });

    await expect(
      publisher.publish("ServicioCreado", { service: { id: "sv-1", tenantId: "t-1" } })
    ).resolves.toBeUndefined();
  });
});
