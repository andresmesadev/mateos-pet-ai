const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const databaseUrl = process.env.MIXED_PAYMENT_TEST_DATABASE_URL || (process.env.CI === 'true' ? process.env.DATABASE_URL : null);

test('mixed payments: PostgreSQL constraint, checkout, concurrent settlement, reports and void exclusion', { skip: !databaseUrl }, async () => {
  const db = new URL(databaseUrl);
  assert(['localhost', '127.0.0.1', '[::1]'].includes(db.hostname));
  assert(db.pathname === '/pos_mixed_test' || (process.env.CI === 'true' && db.pathname === '/mateos_dev'), 'Only an isolated test database is allowed');
  process.env.DATABASE_URL = databaseUrl;
  const prisma = require('../backend/src/lib/prisma');
  const { PrismaTransactionRepository } = require('../backend/src/contexts/finance/infrastructure/persistence/prisma-transaction.repository');
  const { createRegisterManualSaleUseCase } = require('../backend/src/contexts/finance/application/use-cases/pos/register-manual-sale.usecase');
  const { createRegisterAppointmentSaleUseCase } = require('../backend/src/contexts/finance/application/use-cases/pos/register-appointment-sale.usecase');
  const { createSettleSystemChargeUseCase } = require('../backend/src/contexts/finance/application/use-cases/pos/settle-system-charge.usecase');
  const { readOperationalCash } = require('../backend/src/routes/dashboard/operational-cash-page');
  const express = require('../backend/node_modules/express');
  const request = require('../backend/node_modules/supertest');
  const tenantId = randomUUID(), actor = { actorId: 'isolated-cashier' }, access = { capabilities: { administration: true, cash: true, retail: true, services: true } };
  const now = new Date(), date = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 10);
  const repo = new PrismaTransactionRepository();
  let events = 0;
  const deps = { transactionRepository: repo, referencesReader: { validate: async () => {} }, guardManualSaleLink: async () => {}, dailyCloseRepository: { findByDate: async () => null }, businessDayGate: { acquire: async () => {} }, eventPublisher: { publish: async () => { events++; } }, clock: () => now };
  try {
    await prisma.tenant.create({ data: { id: tenantId, name: 'Isolated mixed payment check', slug: 'mixed-' + tenantId, phone: 'test-' + tenantId, activeModules: ['grooming', 'veterinary', 'retail'] } });
    const createManual = createRegisterManualSaleUseCase(deps);
    const manual = await prisma.$transaction(tx => createManual({ tenantId, id: randomUUID(), actor, access, command: { paymentMethod: 'mixed', cashAmount: 30000, transferAmount: 20000 }, items: [{ itemKind: 'service', description: 'Isolated service', quantity: 1, unitPrice: 50000 }], now }, { tx }));
    assert.equal(Number(manual.cashAmount), 30000); assert.equal(manual.items.length, 1);
    await assert.rejects(prisma.transaction.update({ where: { id: manual.id }, data: { cashAmount: 1 } }), /constraint|check/i);
    await assert.rejects(prisma.transaction.update({ where: { id: manual.id }, data: { cashAmount: 0, transferAmount: 50000 } }), /constraint|check/i);
    await assert.rejects(prisma.transaction.update({ where: { id: manual.id }, data: { paymentMethod: 'cash' } }), /constraint|check/i);
    const legacy = await prisma.transaction.create({ data: { tenantId, total: 10000, paymentMethod: 'cash', paidAt: now, recordedActorId: actor.actorId } });
    assert.equal(legacy.cashAmount, null); assert.equal(legacy.transferAmount, null);
    const user = await prisma.user.create({ data: { tenantId, phone: 'fixture-' + randomUUID() } });
    async function visit() {
      const pet = await prisma.pet.create({ data: { tenantId, ownerId: user.id, name: 'Isolated pet', type: 'dog' } });
      return prisma.appointment.create({ data: { tenantId, userId: user.id, petId: pet.id, petName: pet.name, petType: pet.type, serviceType: 'grooming', status: 'completed', finalPrice: 50000, date: now } });
    }
    const appointment = await visit();
    const pending = await repo.createSystemCharge({ tenantId, appointmentId: appointment.id, total: 50000, paidAt: null });
    const checkout = await prisma.$transaction(tx => createRegisterAppointmentSaleUseCase(deps)({ tenantId, actor, access,
      command: { appointmentId: appointment.id, userId: user.id, petId: appointment.petId, paymentMethod: 'mixed', cashAmount: 20000, transferAmount: 30000 },
      items: [{ itemKind: 'service', description: 'Isolated grooming', quantity: 1, unitPrice: 50000, appointmentComponent: 'service' }], now }, { tx }));
    assert.equal(checkout.transaction.id, pending.id); assert.equal(checkout.servicePrice, 50000);
    const otherVisit = await visit();
    const otherCharge = await repo.createSystemCharge({ tenantId, appointmentId: otherVisit.id, total: 50000, paidAt: null });
    const settle = createSettleSystemChargeUseCase(deps), command = { tenantId, appointmentId: otherVisit.id, paymentMethod: 'mixed', cashAmount: 10000, transferAmount: 40000, recordedBy: { id: actor.actorId }, notes: null };
    const concurrent = await Promise.all([1, 2].map(() => prisma.$transaction(tx => settle(command, { tx }))));
    assert.equal(concurrent[0].transaction.id, otherCharge.id); assert.equal(concurrent[1].transaction.id, otherCharge.id); assert.equal(events, 1);
    await assert.rejects(prisma.$transaction(tx => settle({ ...command, cashAmount: 20000, transferAmount: 30000 }, { tx })), /ya fue confirmado/);
    const voided = await prisma.transaction.create({ data: { tenantId, total: 50000, paymentMethod: 'mixed', cashAmount: 25000, transferAmount: 25000, status: 'voided', paidAt: now } });
    const cash = await readOperationalCash(prisma, tenantId, { date, pagination: '1' }, access);
    assert.equal(cash.total, 4); assert.equal(cash.totalRegistered, 160000); assert.equal(cash.summaryCash.mixedCount, 3);
    assert.equal(cash.summaryCash.methods.cash.cents, 7000000); assert.equal(cash.summaryCash.methods.transfer.cents, 9000000);
    const byCash = await readOperationalCash(prisma, tenantId, { date, pagination: '1', method: 'cash' }, access);
    assert.equal(byCash.total, 4);
    const byTransfer = await readOperationalCash(prisma, tenantId, { date, pagination: '1', method: 'transfer' }, access);
    assert.equal(byTransfer.total, 3);
    const app = express(); app.use((req, _res, next) => { req.tenant = { tenantId }; req.access = access; next(); });
    app.use(require('../backend/src/routes/dashboard/expenses.routes'));
    app.use(require('../backend/src/routes/dashboard/reports.routes'));
    const daily = await request(app).get('/metrics/cashbox?date=' + date).expect(200);
    assert.equal(daily.body.totalIncome, 160000); assert.equal(daily.body.transactionCount, 4);
    assert.deepEqual(daily.body.incomeByMethod.map(g => [g.method, g.total]).sort(), [['cash', 70000], ['transfer', 90000]]);
    const reports = await request(app).get('/reports/breakdown?period=month&offset=0').expect(200);
    assert.equal(reports.body.total, 160000); assert.equal(reports.body.count, 4);
    assert.equal(reports.body.byMethod.find(g => g.method === 'cash').total, 70000);
    assert.equal(reports.body.byMethod.find(g => g.method === 'transfer').total, 90000);
    assert.equal(reports.body.mixedCount, 3);
    const fs = require('node:fs'), vm = require('node:vm'), ts = require('../frontend/node_modules/typescript');
    const reportContext = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../frontend/lib/pos-reports.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, reportContext);
    assert.equal(reportContext.exports.parseBreakdown(reports.body).count, 4);
    assert.equal(Number((await prisma.transaction.findUnique({ where: { id: voided.id } })).cashAmount), 25000);
  } finally {
    await prisma.transactionItem.deleteMany({ where: { transaction: { tenantId } } });
    await prisma.transaction.deleteMany({ where: { tenantId } });
    await prisma.appointment.deleteMany({ where: { tenantId } });
    await prisma.pet.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }
});
