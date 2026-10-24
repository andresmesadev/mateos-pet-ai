const { resolvePayment, paymentShares, paymentTotals } = require('../domain/payment-allocation');
const { createRegisterManualSaleUseCase } = require('../application/use-cases/pos/register-manual-sale.usecase');
const { createRegisterAppointmentSaleUseCase } = require('../application/use-cases/pos/register-appointment-sale.usecase');
const { createSettleSystemChargeUseCase } = require('../application/use-cases/pos/settle-system-charge.usecase');
const { fingerprint } = require('../../inventory/domain/policy');
const mixed = { paymentMethod: 'mixed', cashAmount: '30000', transferAmount: '20000' };

test('mixed payments allocate exact cents; single-method legacy rows remain unchanged', () => {
  expect(resolvePayment(mixed, '50000')).toEqual({ paymentMethod: 'mixed', cashAmount: '30000.00', transferAmount: '20000.00' });
  expect(resolvePayment({ paymentMethod: 'cash' }, '50000')).toEqual({ paymentMethod: 'cash' });
  expect(paymentShares({ paymentMethod: 'cash', total: '50000' })).toEqual([{ method: 'cash', amount: 50000 }]);
  expect(resolvePayment({ paymentMethod: 'mixed', cashAmount: '0.10', transferAmount: '0.20' }, '0.30').transferAmount).toBe('0.20');
});
test.each([{ cashAmount: '0' }, { cashAmount: '-1' }, { cashAmount: '30000.001' }, { transferAmount: undefined }, { transferAmount: '19999' }, { transferAmount: '20001' }, { cashAmount: Infinity }, { paymentMethod: 'cash' }])('invalid repartition is rejected: %j', patch => {
  expect(() => resolvePayment({ ...mixed, ...patch }, '50000')).toThrow();
});
test('method sums expand mixed payments without duplicating revenue, including large reporting groups', () => {
  const groups = paymentTotals([{ ...mixed, total: 50000 }, { paymentMethod: 'cash', total: 10000 }, { paymentMethod: 'transfer', total: 15000 }]);
  expect(groups).toEqual([{ method: 'cash', count: 2, total: 40000 }, { method: 'transfer', count: 2, total: 35000 }]);
  expect(groups.reduce((sum, g) => sum + g.total, 0)).toBe(75000);
  expect(paymentShares({ paymentMethod: 'mixed', total: '200000000', cashAmount: '100000000', transferAmount: '100000000' })).toHaveLength(2);
});
test('idempotency fingerprint includes normalized parts and rejects a different split under the same key', () => {
  expect(fingerprint('confirm_pos_sale', mixed)).toBe(fingerprint('confirm_pos_sale', { ...mixed, cashAmount: 30000, transferAmount: '20000.00' }));
  expect(fingerprint('confirm_pos_sale', mixed)).not.toBe(fingerprint('confirm_pos_sale', { ...mixed, cashAmount: 20000, transferAmount: 30000 }));
});
function setup() {
  const charge = { id: 'charge', tenantId: 'tenant', userId: 'owner', petId: 'pet', total: '50000', paidAt: null };
  const repo = { createManualSale: jest.fn(async data => data), lockByAppointment: jest.fn(async () => charge), findCheckoutAppointment: jest.fn(async () => ({ serviceType: 'grooming' })), checkoutPending: jest.fn(async (id, data) => ({ id, ...data })), settle: jest.fn(async (id, data) => { Object.assign(charge, data, { recordedActorId: data.recordedBy.id }); return charge; }) };
  const deps = { transactionRepository: repo, referencesReader: { validate: jest.fn() }, guardManualSaleLink: jest.fn(), dailyCloseRepository: { findByDate: jest.fn(async () => null) }, businessDayGate: { acquire: jest.fn() }, eventPublisher: { publish: jest.fn() } };
  const input = { tenantId: 'tenant', id: 'sale', actor: { actorId: 'cashier' }, access: { capabilities: { cash: true, services: true, retail: true } }, command: { ...mixed, appointmentId: 'visit', userId: 'owner', petId: 'pet' }, items: [{ itemKind: 'service', description: 'Peluquería', quantity: 1, unitPrice: 50000, appointmentComponent: 'service' }], now: new Date('2026-10-24T17:00:00Z') };
  return { charge, repo, deps, input, ctx: { tx: {} } };
}
test('manual sale and appointment checkout persist both parts in one transaction', async () => {
  const s = setup();
  const manual = await createRegisterManualSaleUseCase(s.deps)(s.input, s.ctx);
  expect(manual.cashAmount).toBe('30000.00'); expect(manual.transferAmount).toBe('20000.00'); expect(s.repo.createManualSale).toHaveBeenCalledTimes(1);
  const visit = await createRegisterAppointmentSaleUseCase(s.deps)(s.input, s.ctx);
  expect(visit.transaction.total).toBe('50000.00'); expect(visit.servicePrice).toBe(50000); expect(visit.transaction.cashAmount).toBe('30000.00');
});
test('wrong parts cannot write a manual sale or appointment checkout', async () => {
  const s = setup(); s.input.command.cashAmount = 1;
  await expect(createRegisterManualSaleUseCase(s.deps)(s.input, s.ctx)).rejects.toThrow();
  await expect(createRegisterAppointmentSaleUseCase(s.deps)(s.input, s.ctx)).rejects.toThrow();
  expect(s.repo.createManualSale).not.toHaveBeenCalled(); expect(s.repo.checkoutPending).not.toHaveBeenCalled();
});
test('pending settlement freezes the split, replays once and rejects changing an already paid split', async () => {
  const s = setup(), execute = createSettleSystemChargeUseCase(s.deps);
  const command = { tenantId: 'tenant', appointmentId: 'visit', ...mixed, recordedBy: { id: 'staff:cashier' } };
  await execute(command, s.ctx); await execute(command, s.ctx);
  expect(s.repo.settle).toHaveBeenCalledTimes(1); expect(s.deps.eventPublisher.publish).toHaveBeenCalledTimes(1);
  await expect(execute({ ...command, cashAmount: 20000, transferAmount: 30000 }, s.ctx)).rejects.toThrow('ya fue confirmado');
  expect(s.charge.cashAmount).toBe('30000.00');
});
test('closed day blocks allocation of an old unreviewed charge', async () => {
  const s = setup(); s.charge.paidAt = new Date('2026-10-19T17:00:00Z'); s.deps.dailyCloseRepository.findByDate.mockResolvedValue({ id: 'closed' });
  await expect(createSettleSystemChargeUseCase(s.deps)({ tenantId: 'tenant', appointmentId: 'visit', ...mixed, recordedBy: { id: 'staff:cashier' } }, s.ctx)).rejects.toThrow('cierre oficial');
  expect(s.repo.settle).not.toHaveBeenCalled();
});
