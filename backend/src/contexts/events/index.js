/**
 * Composition root del contexto Eventos. Ensambla las implementaciones de
 * infraestructura e inyecta los puertos en los casos de uso de aplicación.
 * Diseño congelado: docs/history/ENTREGABLE_3_0_GATE_REVIEW.md
 */
const { PrismaEventTypeRepository } = require("./infrastructure/persistence/prisma-event-type.repository");
const { PrismaDomainEventRepository } = require("./infrastructure/persistence/prisma-domain-event.repository");
const { PrismaEventDeliveryRepository } = require("./infrastructure/persistence/prisma-event-delivery.repository");
const { EventsDomainEventsPublisher } = require("./infrastructure/events/events-domain-events.publisher");

const {
  createRegisterEventTypeUseCase,
  createDeactivateEventTypeUseCase,
  createRegisterDomainEventUseCase,
  createGetEventCatalogUseCase,
  createListDomainEventsUseCase,
  createListEventDeliveriesUseCase,
  createRegisterEventDeliveryMechanism,
  createRetryEventDeliveryMechanism,
  createListDomainEventsAwaitingRetryMechanism,
} = require("./application/use-cases");

const eventTypeRepository = new PrismaEventTypeRepository();
const domainEventRepository = new PrismaDomainEventRepository();
const eventDeliveryRepository = new PrismaEventDeliveryRepository();
const eventPublisher = new EventsDomainEventsPublisher();

// Entregable 5.4 — Automatizaciones Multi-Evento: punto de extensión genérico,
// inerte por defecto (no-op). El root de integración de contextos
// (`contexts/index.js`, único lugar autorizado a conocer relaciones entre
// contextos) es quien decide, vía `setDomainEventReactor`, qué ocurre tras
// certificar cualquier Evento de Dominio — sin que este contexto conozca a
// Automatizaciones ni ningún otro consumidor.
const domainEventReactor = { notify: async () => {} };
function setDomainEventReactor(handler) {
  domainEventReactor.notify = handler;
}

const registerEventType = createRegisterEventTypeUseCase({ eventTypeRepository, eventPublisher });
const deactivateEventType = createDeactivateEventTypeUseCase({ eventTypeRepository, eventPublisher });
const registerDomainEvent = createRegisterDomainEventUseCase({
  domainEventRepository,
  eventTypeRepository,
  eventPublisher,
  reactor: domainEventReactor,
});
const getEventCatalog = createGetEventCatalogUseCase({ eventTypeRepository });
const listDomainEvents = createListDomainEventsUseCase({ domainEventRepository });
const listEventDeliveries = createListEventDeliveriesUseCase({ domainEventRepository, eventDeliveryRepository });

const registerEventDelivery = createRegisterEventDeliveryMechanism({ eventDeliveryRepository, eventPublisher });
const retryEventDelivery = createRetryEventDeliveryMechanism({
  domainEventRepository,
  eventDeliveryRepository,
  registerEventDeliveryMechanism: registerEventDelivery,
});
const listDomainEventsAwaitingRetry = createListDomainEventsAwaitingRetryMechanism({ eventDeliveryRepository });

module.exports = {
  registerEventType,
  deactivateEventType,
  registerDomainEvent,
  getEventCatalog,
  listDomainEvents,
  listEventDeliveries,
  // Operaciones de infraestructura — no exponer vía HTTP (ver Etapa 3, sección 5).
  registerEventDelivery,
  retryEventDelivery,
  listDomainEventsAwaitingRetry,
  // Entregable 5.4 — wiring exclusivo del root de integración de contextos.
  setDomainEventReactor,
};
