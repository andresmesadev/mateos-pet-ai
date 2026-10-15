jest.mock('../../../lib/prisma', () => ({ expense: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() }, dailyClose: { create: jest.fn() } }));
const prisma = require('../../../lib/prisma');
const { PrismaExpenseRepository } = require('../infrastructure/persistence/prisma-expense.repository');
const { PrismaDailyCloseRepository } = require('../infrastructure/persistence/prisma-daily-close.repository');
const { PrismaCommissionReader } = require('../infrastructure/persistence/prisma-commission.reader');
const { PrismaCompletedAppointmentsReader } = require('../infrastructure/persistence/prisma-completed-appointments.reader');
const { PrismaTransactionRepository } = require('../infrastructure/persistence/prisma-transaction.repository');

test('escrituras Expense y todas las fuentes del cierre permanecen dentro de ctx.tx', async () => {
  const model = () => ({ create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() });
  const tx = { expense: model(), dailyClose: model(), commission: model(), appointment: model(), transaction: model() }; const ctx = { tx };
  const expenses = new PrismaExpenseRepository();
  await expenses.create({ amount: 1 }, ctx); await expenses.findById('e', ctx);
  await expenses.void('e', { voidedAt: new Date(), voidReason: 'Duplicado' }, ctx);
  await expenses.listByDateRange('t', new Date(), new Date(), ctx);
  await new PrismaDailyCloseRepository().findByDate('t', new Date(), ctx);
  await new PrismaDailyCloseRepository().create({ tenantId: 't' }, ctx);
  await new PrismaCommissionReader().listByDateRange('t', new Date(), new Date(), ctx);
  await new PrismaCompletedAppointmentsReader().listCompletedInRange('t', new Date(), new Date(), ctx);
  await new PrismaTransactionRepository().listByDateRange('t', new Date(), new Date(), ctx);
  for (const m of Object.values(tx)) expect(Object.values(m).some(fn => fn.mock.calls.length)).toBe(true);
  for (const m of Object.values(prisma)) for (const fn of Object.values(m)) expect(fn).not.toHaveBeenCalled();
});
