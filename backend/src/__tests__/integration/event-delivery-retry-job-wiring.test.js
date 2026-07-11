/**
 * Entregable 5.1 (Fase 5) — Outbox de Eventos de Dominio: verifica que el
 * job de reintento descubre Eventos de Dominio pendientes vía el contexto
 * Eventos y los reintenta vía el contexto Automatizaciones, con aislamiento
 * de fallos entre elementos del lote.
 */
jest.mock("../../contexts/events", () => ({
  listDomainEventsAwaitingRetry: jest.fn(),
}));

jest.mock("../../contexts/automation", () => ({
  evaluateAndExecuteRules: jest.fn(),
}));

const events = require("../../contexts/events");
const automation = require("../../contexts/automation");
const { retryFailedDeliveries } = require("../../jobs/event-delivery-retry.job");

beforeEach(() => jest.clearAllMocks());

describe("retryFailedDeliveries (wiring Outbox de Eventos de Dominio)", () => {
  test("sin entregas pendientes: no invoca a Automatizaciones", async () => {
    events.listDomainEventsAwaitingRetry.mockResolvedValue([]);

    const result = await retryFailedDeliveries();

    expect(automation.evaluateAndExecuteRules).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 0, retried: 0 });
  });

  test("con entregas pendientes: reintenta cada una con su payload", async () => {
    const domainEvent = { id: "de-1", tenantId: "t-1", eventTypeId: "et-1", payload: { foo: "bar" } };
    events.listDomainEventsAwaitingRetry.mockResolvedValue([domainEvent]);
    automation.evaluateAndExecuteRules.mockResolvedValue(undefined);

    const result = await retryFailedDeliveries();

    expect(events.listDomainEventsAwaitingRetry).toHaveBeenCalledWith("Automatizaciones");
    expect(automation.evaluateAndExecuteRules).toHaveBeenCalledWith({ domainEvent, eventPayload: domainEvent.payload });
    expect(result).toEqual({ total: 1, retried: 1 });
  });

  test("el fallo de un reintento no impide reintentar los demás del lote", async () => {
    const de1 = { id: "de-1", tenantId: "t-1", eventTypeId: "et-1", payload: {} };
    const de2 = { id: "de-2", tenantId: "t-1", eventTypeId: "et-1", payload: {} };
    events.listDomainEventsAwaitingRetry.mockResolvedValue([de1, de2]);
    automation.evaluateAndExecuteRules
      .mockRejectedValueOnce(new Error("fallo inesperado"))
      .mockResolvedValueOnce(undefined);

    const result = await retryFailedDeliveries();

    expect(automation.evaluateAndExecuteRules).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ total: 2, retried: 1 });
  });

  test("un fallo al descubrir entregas pendientes no lanza excepción", async () => {
    events.listDomainEventsAwaitingRetry.mockRejectedValue(new Error("fallo de conexión"));

    await expect(retryFailedDeliveries()).resolves.toEqual({ total: 0, retried: 0 });
    expect(automation.evaluateAndExecuteRules).not.toHaveBeenCalled();
  });
});
