/**
 * Entregable 5.1 (Fase 5) — Outbox de Eventos de Dominio: descubrimiento de
 * Eventos de Dominio con la última entrega en estado "failed" para un
 * consumidor, sin conocer de antemano el domainEventId.
 */
jest.mock("../../../lib/prisma", () => ({
  eventDelivery: { findMany: jest.fn() },
}));

const prisma = require("../../../lib/prisma");
const { PrismaEventDeliveryRepository } = require("../infrastructure/persistence/prisma-event-delivery.repository");

beforeEach(() => jest.clearAllMocks());

describe("findDomainEventsAwaitingRetry", () => {
  test("retorna solo los Eventos cuya última entrega es 'failed'", async () => {
    prisma.eventDelivery.findMany.mockResolvedValue([
      // de-2: más reciente es "delivered" → no debe aparecer, aunque tuvo un fallo antes.
      { domainEventId: "de-2", consumer: "Automatizaciones", status: "delivered", createdAt: new Date("2026-01-02"), domainEvent: { id: "de-2" } },
      { domainEventId: "de-2", consumer: "Automatizaciones", status: "failed", createdAt: new Date("2026-01-01"), domainEvent: { id: "de-2" } },
      // de-1: única entrega es "failed" → pendiente de reintento.
      { domainEventId: "de-1", consumer: "Automatizaciones", status: "failed", createdAt: new Date("2026-01-01"), domainEvent: { id: "de-1" } },
    ]);

    const repo = new PrismaEventDeliveryRepository();
    const pending = await repo.findDomainEventsAwaitingRetry("Automatizaciones");

    expect(pending.map((e) => e.id)).toEqual(["de-1"]);
  });

  test("retorna vacío si no hay entregas para el consumidor", async () => {
    prisma.eventDelivery.findMany.mockResolvedValue([]);
    const repo = new PrismaEventDeliveryRepository();
    await expect(repo.findDomainEventsAwaitingRetry("Automatizaciones")).resolves.toEqual([]);
  });
});
