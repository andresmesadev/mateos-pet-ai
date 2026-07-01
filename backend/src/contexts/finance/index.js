/**
 * Composition root del contexto Finance. Ensambla las implementaciones de
 * infraestructura e inyecta los puertos en los casos de uso de aplicación.
 */
const { PrismaExpenseRepository } = require("./infrastructure/persistence/prisma-expense.repository");
const { PrismaTransactionRepository } = require("./infrastructure/persistence/prisma-transaction.repository");
const { PrismaDailyCloseRepository } = require("./infrastructure/persistence/prisma-daily-close.repository");
const { PrismaFinancialPeriodRepository } = require("./infrastructure/persistence/prisma-financial-period.repository");
const { PrismaCommissionReader } = require("./infrastructure/persistence/prisma-commission.reader");
const { FinanceDomainEventsPublisher } = require("./infrastructure/events/finance-domain-events.publisher");

const {
  createRegisterExpenseUseCase,
  createVoidExpenseUseCase,
  createRecordChargeOnAppointmentCompletedUseCase,
  createGenerateDailyCloseUseCase,
  createGenerateFinancialPeriodUseCase,
  createGetDailyCloseUseCase,
  createGetFinancialHistoryUseCase,
  createGetFinancialPeriodUseCase,
} = require("./application/use-cases");

const expenseRepository = new PrismaExpenseRepository();
const transactionRepository = new PrismaTransactionRepository();
const dailyCloseRepository = new PrismaDailyCloseRepository();
const financialPeriodRepository = new PrismaFinancialPeriodRepository();
const commissionReader = new PrismaCommissionReader();
const eventPublisher = new FinanceDomainEventsPublisher();

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
  dailyCloseRepository,
  eventPublisher,
});
const generateFinancialPeriod = createGenerateFinancialPeriodUseCase({
  dailyCloseRepository,
  financialPeriodRepository,
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

module.exports = {
  registerExpense,
  voidExpense,
  recordChargeOnAppointmentCompleted,
  generateDailyClose,
  generateFinancialPeriod,
  getDailyClose,
  getFinancialHistory,
  getFinancialPeriod,
};
