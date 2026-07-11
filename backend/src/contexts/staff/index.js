/**
 * Composition root del contexto Staff. Ensambla las implementaciones de
 * infraestructura e inyecta los puertos en los casos de uso de aplicación.
 *
 * Entregable 5.2: depende de Eventos únicamente para certificar sus propios
 * eventos como Evento de Dominio real (events.registerDomainEvent, reutilizado
 * sin cambios).
 */
const { PrismaStaffRepository } = require("./infrastructure/persistence/prisma-staff.repository");
const { PrismaAvailabilityRepository } = require("./infrastructure/persistence/prisma-availability.repository");
const { PrismaStaffCapabilityRepository } = require("./infrastructure/persistence/prisma-staff-capability.repository");
const { PrismaCommissionRepository } = require("./infrastructure/persistence/prisma-commission.repository");
const { PrismaSettlementRepository } = require("./infrastructure/persistence/prisma-settlement.repository");
const { PrismaServiceExistenceReader } = require("./infrastructure/persistence/prisma-service-existence.reader");
const { PrismaServiceCategoryReader } = require("./infrastructure/persistence/prisma-service-category.reader");
const { PrismaBusinessConfigReader } = require("./infrastructure/persistence/prisma-business-config.reader");
const { StaffDomainEventsPublisher } = require("./infrastructure/events/staff-domain-events.publisher");
const events = require("../events");

const {
  createRegisterStaffUseCase,
  createUpdateStaffUseCase,
  createDeactivateStaffUseCase,
  createReactivateStaffUseCase,
  createUpdateAvailabilityUseCase,
  createManageStaffCapabilitiesUseCase,
  createRecordUnplannedAbsenceUseCase,
  createRecordCommissionOnAppointmentCompletedUseCase,
  createGenerateSettlementUseCase,
  createResolveStaffAvailabilityUseCase,
  createListActiveStaffUseCase,
  createListSettlementsUseCase,
} = require("./application/use-cases");

const staffRepository = new PrismaStaffRepository();
const availabilityRepository = new PrismaAvailabilityRepository();
const staffCapabilityRepository = new PrismaStaffCapabilityRepository();
const commissionRepository = new PrismaCommissionRepository();
const settlementRepository = new PrismaSettlementRepository();
const serviceExistenceReader = new PrismaServiceExistenceReader();
const serviceCategoryReader = new PrismaServiceCategoryReader();
const businessConfigReader = new PrismaBusinessConfigReader();
const eventPublisher = new StaffDomainEventsPublisher({ registerDomainEvent: events.registerDomainEvent });

const registerStaff = createRegisterStaffUseCase({ staffRepository, eventPublisher });
const updateStaff = createUpdateStaffUseCase({ staffRepository, eventPublisher });
const deactivateStaff = createDeactivateStaffUseCase({ staffRepository, eventPublisher });
const reactivateStaff = createReactivateStaffUseCase({ staffRepository, staffCapabilityRepository, eventPublisher });
const updateAvailability = createUpdateAvailabilityUseCase({ staffRepository, availabilityRepository, eventPublisher });
const manageStaffCapabilities = createManageStaffCapabilitiesUseCase({
  staffRepository,
  staffCapabilityRepository,
  serviceExistenceReader,
  eventPublisher,
});
const recordUnplannedAbsence = createRecordUnplannedAbsenceUseCase({ staffRepository, availabilityRepository, eventPublisher });
const recordCommissionOnAppointmentCompleted = createRecordCommissionOnAppointmentCompletedUseCase({
  staffRepository,
  commissionRepository,
  serviceCategoryReader,
  businessConfigReader,
  eventPublisher,
});
const generateSettlement = createGenerateSettlementUseCase({
  staffRepository,
  commissionRepository,
  settlementRepository,
  eventPublisher,
});
const resolveStaffAvailability = createResolveStaffAvailabilityUseCase({
  staffRepository,
  staffCapabilityRepository,
  availabilityRepository,
  serviceExistenceReader,
});
const listActiveStaff = createListActiveStaffUseCase({ staffRepository, staffCapabilityRepository });
const listSettlements = createListSettlementsUseCase({ settlementRepository });

// Entregable Puente — ADR 009
const { PrismaSettlementCoverageReader } = require("./infrastructure/persistence/prisma-settlement-coverage.reader");
const { PrismaDailyCloseReader } = require("./infrastructure/persistence/prisma-daily-close.reader");
const { createVoidCommissionUseCase } = require("./application/use-cases");

const voidCommission = createVoidCommissionUseCase({
  commissionRepository,
  settlementCoverageReader: new PrismaSettlementCoverageReader(),
  dailyCloseReader: new PrismaDailyCloseReader(),
  eventPublisher,
});

module.exports = {
  voidCommission,
  registerStaff,
  updateStaff,
  deactivateStaff,
  reactivateStaff,
  updateAvailability,
  manageStaffCapabilities,
  recordUnplannedAbsence,
  recordCommissionOnAppointmentCompleted,
  generateSettlement,
  resolveStaffAvailability,
  listActiveStaff,
  listSettlements,
};
