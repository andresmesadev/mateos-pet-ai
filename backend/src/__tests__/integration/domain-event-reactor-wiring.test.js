/**
 * Entregable 5.4 (Fase 5) — Automatizaciones Multi-Evento: verifica que el
 * root de integración de contextos engancha `evaluateAndExecuteRules` al
 * reactor genérico de certificación (`events.setDomainEventReactor`) para
 * cualquier Evento de Dominio, excepto los 5 eventos internos de
 * Automatizaciones (carve-out no negociable de la Macroetapa 2).
 */
jest.mock("../../contexts/shared/persistence/prisma-unit-of-work", () => ({
  PrismaUnitOfWork: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../contexts/agenda", () => ({
  buildAgendaContext: jest.fn().mockReturnValue({ completeAppointment: jest.fn() }),
}));

jest.mock("../../contexts/staff", () => ({
  recordCommissionOnAppointmentCompleted: jest.fn(),
}));

jest.mock("../../contexts/finance", () => ({
  recordChargeOnAppointmentCompleted: jest.fn(),
}));

jest.mock("../../contexts/automation", () => ({
  evaluateAndExecuteRules: jest.fn(),
}));

jest.mock("../../contexts/events", () => ({
  registerDomainEvent: jest.fn(),
  setDomainEventReactor: jest.fn(),
}));

const events = require("../../contexts/events");
const automation = require("../../contexts/automation");

describe("Wiring del reactor genérico de Eventos de Dominio → Automatizaciones", () => {
  let reactor;

  beforeAll(() => {
    require("../../contexts/index");
    expect(events.setDomainEventReactor).toHaveBeenCalledTimes(1);
    reactor = events.setDomainEventReactor.mock.calls[0][0];
  });

  beforeEach(() => jest.clearAllMocks());

  test("CitaCompletada invoca evaluateAndExecuteRules", async () => {
    const domainEvent = { id: "de-1", tenantId: "t-1", eventTypeId: "et-1" };
    const payload = { tenantId: "t-1" };

    await reactor({ domainEvent, eventTypeName: "CitaCompletada", payload }, { tx: "fake" });

    expect(automation.evaluateAndExecuteRules).toHaveBeenCalledWith(
      { domainEvent, eventPayload: payload },
      { tx: "fake" }
    );
  });

  test("un evento certificado de cualquier otro contexto también invoca evaluateAndExecuteRules", async () => {
    const domainEvent = { id: "de-2", tenantId: "t-1", eventTypeId: "et-2" };
    const payload = { tenantId: "t-1", userId: "u-1", phone: "+57..." };

    await reactor({ domainEvent, eventTypeName: "MensajeEnviado", payload }, undefined);

    expect(automation.evaluateAndExecuteRules).toHaveBeenCalledWith({ domainEvent, eventPayload: payload }, undefined);
  });

  test.each([
    "ReglaDeAutomatizacionRegistrada",
    "ReglaDeAutomatizacionActivada",
    "ReglaDeAutomatizacionDesactivada",
    "PlantillaDeAutomatizacionRegistrada",
    "PlantillaDeAutomatizacionActivada",
  ])("%s (evento interno de Automatizaciones) nunca invoca evaluateAndExecuteRules", async (eventTypeName) => {
    const domainEvent = { id: "de-3", tenantId: "t-1", eventTypeId: "et-3" };

    await reactor({ domainEvent, eventTypeName, payload: {} }, undefined);

    expect(automation.evaluateAndExecuteRules).not.toHaveBeenCalled();
  });
});
