/**
 * Composition root del contexto Finance. Ensambla las implementaciones de
 * infraestructura e inyecta los puertos en los casos de uso de aplicación.
 *
 * Entregable 5.2: depende de Eventos únicamente para certificar sus propios
 * eventos como Evento de Dominio real (events.registerDomainEvent, reutilizado
 * sin cambios).
 */
const { PrismaExpenseRepository } = require("./infrastructure/persistence/prisma-expense.repository");
const { PrismaTransactionRepository } = require("./infrastructure/persistence/prisma-transaction.repository");
const { PrismaDailyCloseRepository } = require("./infrastructure/persistence/prisma-daily-close.repository");
const { PrismaFinancialPeriodRepository } = require("./infrastructure/persistence/prisma-financial-period.repository");
const { PrismaCommissionReader } = require("./infrastructure/persistence/prisma-commission.reader");
const { PrismaCompletedAppointmentsReader } = require("./infrastructure/persistence/prisma-completed-appointments.reader");
const { FinanceDomainEventsPublisher } = require("./infrastructure/events/finance-domain-events.publisher");
const { PrismaUnitOfWork } = require("../shared/persistence/prisma-unit-of-work");
const { PrismaBusinessDayGate } = require("../shared/persistence/prisma-business-day-gate");
const { transactionalCommand } = require("../shared/persistence/transactional-events");
const events = require("../events");

const {
  createRegisterExpenseUseCase,
  createVoidExpenseUseCase,
  createRecordChargeOnAppointmentCompletedUseCase,
  createGenerateDailyCloseUseCase,
  createGenerateFinancialPeriodUseCase,
  createGetDailyCloseUseCase,
  createGetFinancialHistoryUseCase,
  createGetFinancialPeriodUseCase,
  createSettleSystemChargeUseCase,
  createGuardManualSaleLinkUseCase,
  createVoidManualSaleUseCase,
} = require("./application/use-cases");

const expenseRepository = new PrismaExpenseRepository();
const transactionRepository = new PrismaTransactionRepository();
const dailyCloseRepository = new PrismaDailyCloseRepository();
const financialPeriodRepository = new PrismaFinancialPeriodRepository();
const commissionReader = new PrismaCommissionReader();
const completedAppointmentsReader = new PrismaCompletedAppointmentsReader();
const eventPublisher = new FinanceDomainEventsPublisher({ registerDomainEvent: events.registerDomainEvent });
const unitOfWork = new PrismaUnitOfWork();

function buildTransactionalFinance({ eventPublisher: publisher = eventPublisher, unitOfWork: work = unitOfWork, businessDayGate = new PrismaBusinessDayGate() } = {}) {
  const deps = { expenseRepository, dailyCloseRepository, eventPublisher: publisher, businessDayGate };
  const wrap = command => transactionalCommand(command, { unitOfWork: work, eventPublisher: publisher });
  return {
    registerExpense: wrap(createRegisterExpenseUseCase(deps)),
    voidExpense: wrap(createVoidExpenseUseCase(deps)),
    generateDailyClose: wrap(createGenerateDailyCloseUseCase({ ...deps, transactionRepository, commissionReader, completedAppointmentsReader })),
  };
}
const { registerExpense, voidExpense, generateDailyClose } = buildTransactionalFinance();
const recordChargeOnAppointmentCompleted = createRecordChargeOnAppointmentCompletedUseCase({
  transactionRepository,
  eventPublisher,
});
const generateFinancialPeriod = createGenerateFinancialPeriodUseCase({
  dailyCloseRepository,
  financialPeriodRepository,
  unitOfWork,
  eventPublisher,
});
const getDailyClose = createGetDailyCloseUseCase({ dailyCloseRepository });
const getFinancialHistory = createGetFinancialHistoryUseCase({
  dailyCloseRepository,
  transactionRepository,
  expenseRepository,
  commissionReader,
});
const getFinancialPeriod = createGetFinancialPeriodUseCase({ financialPeriodRepository });

// POS — proceso de cobro (ADR 007-D3)
const settleSystemCharge = transactionalCommand(createSettleSystemChargeUseCase({ transactionRepository, eventPublisher, businessDayGate: new PrismaBusinessDayGate(), dailyCloseRepository }), { unitOfWork, eventPublisher });
const guardManualSaleLink = createGuardManualSaleLinkUseCase({ transactionRepository, completedAppointmentsReader });
const voidSalePublisher = { publish: (name, payload) => name === 'ComisiónAnulada' ? require('../staff').publishCheckoutCorrection({ name, payload }) : eventPublisher.publish(name, payload) };
const voidManualSale = transactionalCommand(createVoidManualSaleUseCase({ transactionRepository, dailyCloseRepository, eventPublisher, businessDayGate: new PrismaBusinessDayGate(), voidSaleCommissions: (input, ctx) => require('../staff').voidSaleCommissions(input, ctx) }), { unitOfWork, eventPublisher: voidSalePublisher });
const { createRegisterManualSaleUseCase } = require('./application/use-cases/pos/register-manual-sale.usecase');
const { PrismaPosReferencesReader } = require('./infrastructure/persistence/prisma-pos-references.reader');
const registerManualSale = createRegisterManualSaleUseCase({ transactionRepository, referencesReader: new PrismaPosReferencesReader(), guardManualSaleLink, dailyCloseRepository });
const { createRegisterAppointmentSaleUseCase } = require('./application/use-cases/pos/register-appointment-sale.usecase');
const registerAppointmentSale = createRegisterAppointmentSaleUseCase({ transactionRepository, referencesReader: new PrismaPosReferencesReader(), dailyCloseRepository, businessDayGate: new PrismaBusinessDayGate() });

module.exports = {
  registerAppointmentSale,
  publishCheckoutPayment: transaction => eventPublisher.publish('CobroLiquidado', { transaction }),
  buildTransactionalFinance,
  registerManualSale,
  registerExpense,
  voidExpense,
  recordChargeOnAppointmentCompleted,
  generateDailyClose,
  generateFinancialPeriod,
  getDailyClose,
  getFinancialHistory,
  getFinancialPeriod,
  settleSystemCharge,
  guardManualSaleLink,
  voidManualSale,
};
