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

const registerEventType = createRegisterEventTypeUseCase({ eventTypeRepository, eventPublisher });
const deactivateEventType = createDeactivateEventTypeUseCase({ eventTypeRepository, eventPublisher });
const registerDomainEvent = createRegisterDomainEventUseCase({ domainEventRepository, eventTypeRepository, eventPublisher });
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
};
