/**
 * Composition root del contexto Servicios. Ensambla las implementaciones
 * de infraestructura e inyecta los puertos en los casos de uso de
 * aplicación. Cualquier adaptador (HTTP, mensajería, un futuro Empleado
 * Digital) importa este módulo en lugar de construir sus propias instancias.
 */
const { PrismaServiceRepository } = require("./infrastructure/persistence/prisma-service.repository");
const { PrismaPriceRuleRepository } = require("./infrastructure/persistence/prisma-price-rule.repository");
const { PrismaServiceCategoryReader } = require("./infrastructure/persistence/prisma-service-category.reader");
const { PrismaBusinessConfigReader } = require("./infrastructure/persistence/prisma-business-config.reader");
const { PrismaTargetExistenceReader } = require("./infrastructure/persistence/prisma-target-existence.reader");
const { ServiceDomainEventsPublisher } = require("./infrastructure/events/service-domain-events.publisher");

const {
  createCreateServiceUseCase,
  createUpdateServiceUseCase,
  createDeactivateServiceUseCase,
  createChangeServicePriceUseCase,
  createResolveServicePriceUseCase,
  createListAvailableServicesUseCase,
} = require("./application/use-cases");

const serviceRepository = new PrismaServiceRepository();
const priceRuleRepository = new PrismaPriceRuleRepository();
const serviceCategoryReader = new PrismaServiceCategoryReader();
const businessConfigReader = new PrismaBusinessConfigReader();
const targetExistenceReader = new PrismaTargetExistenceReader();
const eventPublisher = new ServiceDomainEventsPublisher();

const createService = createCreateServiceUseCase({ serviceRepository, serviceCategoryReader, businessConfigReader, eventPublisher });
const updateService = createUpdateServiceUseCase({ serviceRepository, serviceCategoryReader, businessConfigReader, eventPublisher });
const deactivateService = createDeactivateServiceUseCase({ serviceRepository, eventPublisher });
const changeServicePrice = createChangeServicePriceUseCase({ serviceRepository, priceRuleRepository, targetExistenceReader, eventPublisher });
const resolveServicePrice = createResolveServicePriceUseCase({ serviceRepository, priceRuleRepository, targetExistenceReader });
const listAvailableServices = createListAvailableServicesUseCase({ serviceRepository, serviceCategoryReader, businessConfigReader });

module.exports = {
  createService,
  updateService,
  deactivateService,
  changeServicePrice,
  resolveServicePrice,
  listAvailableServices,
};
