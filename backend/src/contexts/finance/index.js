/**
 * Composition root del contexto Finance. Ensambla las implementaciones de
 * infraestructura e inyecta los puertos en los casos de uso de aplicación.
 */
const { PrismaExpenseRepository } = require("./infrastructure/persistence/prisma-expense.repository");
const { PrismaTransactionRepository } = require("./infrastructure/persistence/prisma-transaction.repository");
const { PrismaDailyCloseRepository } = require("./infrastructure/persistence/prisma-daily-close.repository");
const { PrismaFinancialPeriodRepository } = require("./infrastructure/persistence/prisma-financial-period.repository");
const { PrismaCommissionReader } = require("./infrastructure/persistence/prisma-commission.reader");
const { PrismaCompletedAppointmentsReader } = require("./infrastructure/persistence/prisma-completed-appointments.reader");
const { FinanceDomainEventsPublisher } = require("./infrastructure/events/finance-domain-events.publisher");
const { PrismaUnitOfWork } = require("../shared/persistence/prisma-unit-of-work");

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
const eventPublisher = new FinanceDomainEventsPublisher();
const unitOfWork = new PrismaUnitOfWork();

const registerExpense = createRegisterExpenseUseCase({ expenseRepository, dailyCloseRepository, eventPublisher });
const voidExpense = createVoidExpenseUseCase({ expenseRepository, dailyCloseRepository, eventPublisher });
const recordChargeOnAppointmentCompleted = createRecordChargeOnAppointmentCompletedUseCase({
  transactionRepository,
  eventPublisher,
});
const generateDailyClose = createGenerateDailyCloseUseCase({
  transactionRepository,
  expenseRepository,
  commissionReader,
  completedAppointmentsReader,
  dailyCloseRepository,
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
const settleSystemCharge = createSettleSystemChargeUseCase({ transactionRepository, eventPublisher });
const guardManualSaleLink = createGuardManualSaleLinkUseCase({ transactionRepository, completedAppointmentsReader });
const voidManualSale = createVoidManualSaleUseCase({ transactionRepository, dailyCloseRepository, eventPublisher });

module.exports = {
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
