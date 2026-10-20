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
const { PrismaStaffFinanceGate } = require('../shared/persistence/prisma-staff-finance-gate');
const { PrismaUnitOfWork } = require('../shared/persistence/prisma-unit-of-work');
const { transactionalCommand } = require('../shared/persistence/transactional-events');

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
const { createCorrectAbsenceUseCase } = require('./application/use-cases/correct-absence.usecase');
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
const generateSettlement = transactionalCommand(createGenerateSettlementUseCase({
  staffRepository,
  commissionRepository,
  settlementRepository,
  eventPublisher,
  staffFinanceGate: new PrismaStaffFinanceGate(),
}), { unitOfWork: new PrismaUnitOfWork(), eventPublisher });
const resolveStaffAvailability = createResolveStaffAvailabilityUseCase({
  staffRepository,
  staffCapabilityRepository,
  availabilityRepository,
  serviceExistenceReader,
  serviceCategoryReader,
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
const { createCorrectCheckoutCommissionUseCase } = require('./application/use-cases/correct-checkout-commission.usecase');
const { PrismaBusinessDayGate } = require('../shared/persistence/prisma-business-day-gate');
const correctCheckoutCommission = createCorrectCheckoutCommissionUseCase({ commissionRepository, voidCommission, businessDayGate: new PrismaBusinessDayGate(), staffFinanceGate: new PrismaStaffFinanceGate() });
const { createRecordSaleServiceCommissionUseCase } = require('./application/use-cases/record-sale-service-commission.usecase');
const { PrismaSaleServiceReader } = require('./infrastructure/persistence/prisma-sale-service.reader');
const recordSaleServiceCommission = transactionalCommand(createRecordSaleServiceCommissionUseCase({ sourceReader: new PrismaSaleServiceReader(), staffRepository, serviceCategoryReader, businessConfigReader, commissionRepository, dailyCloseReader: new PrismaDailyCloseReader(), settlementCoverageReader: new PrismaSettlementCoverageReader(), businessDayGate: new PrismaBusinessDayGate(), staffFinanceGate: new PrismaStaffFinanceGate() }), { unitOfWork: new PrismaUnitOfWork(), eventPublisher });

module.exports = {
  async voidSaleCommissions({ tenantId, transactionId, reason }, ctx) {
    if (!ctx?.tx || !ctx.eventPublisher) throw new Error('Void sale commissions requires transaction');
    const rows = await commissionRepository.listByTransaction(tenantId, transactionId, ctx);
    const gate = new PrismaStaffFinanceGate();
    for (const row of rows) {
      await gate.acquire(tenantId, row.staffId, ctx);
      await voidCommission({ tenantId, commissionId: row.id, reason, replacement: null }, ctx);
    }
  },
  recordSaleServiceCommission,
  async recordSaleCommissions({ tenantId, transaction, access }, ctx) {
    for (const item of transaction.items ?? []) if (item.serviceId && !item.appointmentComponent) await recordSaleServiceCommission({ tenantId, transactionItemId: item.id, serviceId: item.serviceId, staffId: item.performedByStaffId, activeModules: access.activeModules }, ctx);
  },
  correctCheckoutCommission,
  publishCheckoutCorrection: event => eventPublisher.publish(event.name, event.payload),
  // Casos existentes sobre el cliente transaccional de la operación de Agenda.
  availabilityCommands(db, publisher) {
    const deps = {
      staffRepository: { findById: id => db.staff.findUnique({ where: { id } }) },
      availabilityRepository: {
        findById: id => db.staffAvailability.findUnique({ where: { id } }),
        voidCurrent: (id, data) => db.staffAvailability.updateMany({ where: { id, voidedAt: null }, data }),
        listByStaff: staffId => db.staffAvailability.findMany({ where: { staffId } }),
        listBaseScheduleByStaff: staffId => db.staffAvailability.findMany({ where: { staffId, type: 'base_schedule' } }),
        create: data => db.staffAvailability.create({ data }),
      },
      eventPublisher: publisher,
    };
    return { updateAvailability: createUpdateAvailabilityUseCase(deps), recordUnplannedAbsence: createRecordUnplannedAbsenceUseCase(deps), correctAbsence: createCorrectAbsenceUseCase(deps) };
  },
  capabilitiesCommand(db, publisher, tenantId) {
    return createManageStaffCapabilitiesUseCase({
      staffRepository: { findById: id => db.staff.findUnique({ where: { id } }) },
      staffCapabilityRepository: new PrismaStaffCapabilityRepository(db),
      serviceExistenceReader: { exists: async id => Boolean(await db.service.findFirst({ where: { id, tenantId } })) },
      eventPublisher: publisher,
    });
  },
  publishAvailabilityEvent: (name, payload) => eventPublisher.publish(name, payload),
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
