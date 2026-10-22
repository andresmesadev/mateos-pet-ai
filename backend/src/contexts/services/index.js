/**
 * Composition root del contexto Servicios. Ensambla las implementaciones
 * de infraestructura e inyecta los puertos en los casos de uso de
 * aplicación. Cualquier adaptador (HTTP, mensajería, un futuro Empleado
 * Digital) importa este módulo en lugar de construir sus propias instancias.
 *
 * Entregable 5.2: depende de Eventos únicamente para certificar sus propios
 * eventos como Evento de Dominio real (events.registerDomainEvent, reutilizado
 * sin cambios).
 */
const { PrismaServiceRepository } = require("./infrastructure/persistence/prisma-service.repository");
const { PrismaPriceRuleRepository } = require("./infrastructure/persistence/prisma-price-rule.repository");
const { PrismaServiceCategoryReader } = require("./infrastructure/persistence/prisma-service-category.reader");
const { PrismaBusinessConfigReader } = require("./infrastructure/persistence/prisma-business-config.reader");
const { PrismaTargetExistenceReader } = require("./infrastructure/persistence/prisma-target-existence.reader");
const { ServiceDomainEventsPublisher } = require("./infrastructure/events/service-domain-events.publisher");
const events = require("../events");
const { createDeleteRetiredServiceUseCase } = require("./application/use-cases/delete-retired-service.usecase");

const {
  createCreateServiceUseCase,
  createUpdateServiceUseCase,
  createDeactivateServiceUseCase,
  createChangeServicePriceUseCase,
  createResolveServicePriceUseCase,
  createListAvailableServicesUseCase,
  createGetServiceCategoryUseCase,
} = require("./application/use-cases");

const serviceRepository = new PrismaServiceRepository();
const deleteRetiredService = createDeleteRetiredServiceUseCase({ serviceRepository });
const priceRuleRepository = new PrismaPriceRuleRepository();
const serviceCategoryReader = new PrismaServiceCategoryReader();
const businessConfigReader = new PrismaBusinessConfigReader();
const targetExistenceReader = new PrismaTargetExistenceReader();
const eventPublisher = new ServiceDomainEventsPublisher({ registerDomainEvent: events.registerDomainEvent });

const createService = createCreateServiceUseCase({ serviceRepository, serviceCategoryReader, businessConfigReader, eventPublisher });
const updateService = createUpdateServiceUseCase({ serviceRepository, serviceCategoryReader, businessConfigReader, eventPublisher });
const deactivateService = createDeactivateServiceUseCase({ serviceRepository, eventPublisher });
const changeServicePrice = createChangeServicePriceUseCase({ serviceRepository, priceRuleRepository, targetExistenceReader, eventPublisher });
// Same domain command, bound to the caller's transaction. Publish only after commit.
async function changePetServicePriceInTransaction(input, { tx, afterCommit }) {
  if (!tx || !Array.isArray(afterCommit) || input.target?.type !== 'pet') throw new Error('Pet price transaction required');
  const change = createChangeServicePriceUseCase({
    serviceRepository: new PrismaServiceRepository(tx),
    priceRuleRepository: new PrismaPriceRuleRepository(tx),
    targetExistenceReader: new PrismaTargetExistenceReader(tx),
    eventPublisher: { publish: async (name, payload) => { afterCommit.push(() => eventPublisher.publish(name, payload)); } },
  });
  return change(input);
}
const resolveServicePrice = createResolveServicePriceUseCase({ serviceRepository, priceRuleRepository, targetExistenceReader });
const listAvailableServices = createListAvailableServicesUseCase({ serviceRepository, serviceCategoryReader, businessConfigReader });
const getServiceCategory = createGetServiceCategoryUseCase({ serviceRepository, serviceCategoryReader });

module.exports = {
  deleteRetiredService,
  createService,
  updateService,
  deactivateService,
  changeServicePrice,
  changePetServicePriceInTransaction,
  resolveServicePrice,
  listAvailableServices,
  getServiceCategory,
};
