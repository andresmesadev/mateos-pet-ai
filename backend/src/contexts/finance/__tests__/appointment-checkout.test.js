const { createRegisterAppointmentSaleUseCase } = require('../application/use-cases/pos/register-appointment-sale.usecase');
const { createCorrectCheckoutCommissionUseCase } = require('../../staff/application/use-cases/correct-checkout-commission.usecase');
function setup() {
  const charge = { id: 'charge', userId: 'owner', petId: 'pet', paidAt: null };
  const repo = { lockByAppointment: jest.fn(async () => charge), findCheckoutAppointment: jest.fn(async () => ({ serviceType: 'grooming' })), checkoutPending: jest.fn(async (id, data) => ({ id, ...data })) };
  const reader = { validate: jest.fn() }, close = { findByDate: jest.fn(async () => null) }, gate = { acquire: jest.fn() };
  const execute = createRegisterAppointmentSaleUseCase({ transactionRepository: repo, referencesReader: reader, dailyCloseRepository: close, businessDayGate: gate });
  const input = { tenantId: 'tenant', actor: { actorId: 'staff:cashier' }, access: { capabilities: { cash: true, services: true, retail: true } },
    command: { appointmentId: 'appointment', userId: 'owner', petId: 'pet', paymentMethod: 'cash' }, now: new Date('2026-10-17T16:00:00Z'),
    items: [{ itemKind: 'service', description: 'Peluquería', quantity: 1, unitPrice: 100000, appointmentComponent: 'service' }, { itemKind: 'service', description: 'Domicilio', quantity: 1, unitPrice: 10000, appointmentComponent: 'transport' }, { itemKind: 'service', description: 'Colorimetría', quantity: 1, unitPrice: 15000 }] };
  return { charge, repo, reader, close, execute, input, ctx: { tx: {} } };
}
test('one pending obligation receives the final service, domicile and extra amounts without changing the primary commission base', async () => {
  const s = setup(); const result = await s.execute(s.input, s.ctx);
  expect(result.transaction.id).toBe('charge'); expect(result.transaction.total).toBe('125000.00'); expect(result.servicePrice).toBe(100000);
  expect(result.transaction.items[1].appointmentComponent).toBe('transport');
  expect(s.reader.validate).toHaveBeenCalledWith('tenant', s.input.command, s.ctx, { completed: true });
});
test.each(['paid', 'owner', 'closed', 'missing', 'quantity'])('%s checkout is rejected before writing', async kind => {
  const s = setup();
  if (kind === 'paid') s.charge.paidAt = new Date();
  if (kind === 'owner') s.input.command.userId = 'foreign';
  if (kind === 'closed') s.close.findByDate.mockResolvedValue({ id: 'close' });
  if (kind === 'missing') s.input.items.shift();
  if (kind === 'quantity') s.input.items[0].quantity = 2;
  await expect(s.execute(s.input, s.ctx)).rejects.toThrow(); expect(s.repo.checkoutPending).not.toHaveBeenCalled();
});
test('zero is an explicit free appointment component while empty or negative prices remain invalid', async () => {
  const s = setup(); s.input.items = s.input.items.slice(0, 2).map(item => ({ ...item, unitPrice: 0 }));
  expect((await s.execute(s.input, s.ctx)).transaction.total).toBe('0.00');
  s.input.items[0].unitPrice = ''; await expect(s.execute(s.input, s.ctx)).rejects.toThrow();
});

test('a deferred vaccination receives its first obligation only when Caja submits its actual price', async () => {
  const s = setup(); s.repo.lockByAppointment.mockResolvedValue(null);
  s.repo.findCheckoutAppointment.mockResolvedValue({ serviceType: 'vet' });
  s.repo.findDeferredAppointment = jest.fn(async () => ({ id: 'appointment', userId: 'owner', petId: 'pet', staffId: 'vet', serviceId: 'vaccination' }));
  s.repo.valueDeferredAppointment = jest.fn(); s.repo.createSystemCharge = jest.fn(async () => ({ ...s.charge, id: 'new-charge' }));
  s.input.items = [s.input.items[0]];
  const result = await s.execute(s.input, s.ctx);
  expect(s.repo.valueDeferredAppointment).toHaveBeenCalledWith('tenant', 'appointment', 100000, s.ctx);
  expect(s.repo.createSystemCharge).toHaveBeenCalledWith({ tenantId: 'tenant', appointmentId: 'appointment', total: '100000.00', paidAt: null }, s.ctx);
  expect(s.repo.checkoutPending).toHaveBeenCalledWith('new-charge', expect.objectContaining({ paidAt: s.input.now }), s.ctx);
  expect(result.deferredAppointment.staffId).toBe('vet');
});

test.each(['unvalued', 'wrong-owner', 'closed', 'transport'])('deferred checkout rejects %s before creating any obligation', async kind => {
  const s = setup(); s.repo.lockByAppointment.mockResolvedValue(null);
  s.repo.findCheckoutAppointment.mockResolvedValue({ serviceType: 'vet' });
  s.repo.findDeferredAppointment = jest.fn(async () => ({ id: 'appointment', userId: 'owner', petId: 'pet' }));
  s.repo.valueDeferredAppointment = jest.fn(); s.repo.createSystemCharge = jest.fn();
  if (kind !== 'transport') s.input.items = [s.input.items[0]];
  if (kind === 'unvalued') s.input.items[0].unitPrice = '';
  if (kind === 'wrong-owner') s.input.command.userId = 'foreign';
  if (kind === 'closed') s.close.findByDate.mockResolvedValue({ id: 'closed' });
  await expect(s.execute(s.input, s.ctx)).rejects.toThrow();
  expect(s.repo.createSystemCharge).not.toHaveBeenCalled(); expect(s.repo.valueDeferredAppointment).not.toHaveBeenCalled();
});

test('vaccination can collect only its inventory products, preserving catalogue snapshots and quantities', async () => {
  const s = setup();
  s.repo.findCheckoutAppointment.mockResolvedValue({ serviceType: 'grooming', service: { category: { name: 'other' } } });
  s.input.items = [
    { description: 'Vacuna hexavalente', itemKind: 'product', quantity: 1, unitPrice: 74000, product: { tenantId: 'tenant', id: 'vaccine', internalCode: 'va-003', presentation: '1 ml', priceVersion: 2 } },
    { description: 'Antiparasitario', itemKind: 'product', quantity: 2, unitPrice: 14000, product: { tenantId: 'tenant', id: 'tablet', internalCode: 'MED-016', presentation: 'tableta', priceVersion: 1 } },
  ];
  const result = await s.execute(s.input, s.ctx);
  expect(result.transaction.total).toBe('102000.00'); expect(result.servicePrice).toBeNull();
  expect(result.transaction.items).toEqual([expect.objectContaining({ productId: 'vaccine', quantity: 1 }), expect.objectContaining({ productId: 'tablet', quantity: 2 })]);
  expect(result.transaction.items.every(i => !i.appointmentComponent)).toBe(true);
});

test('a browser cannot remove the grooming line by sending an optional-service flag', async () => {
  const s = setup(); s.input.command.requiresServiceLine = false;
  s.input.items = [{ description: 'Vacuna', itemKind: 'product', quantity: 1, unitPrice: 74000 }];
  await expect(s.execute(s.input, s.ctx)).rejects.toThrow(/peluquería/);
  expect(s.repo.checkoutPending).not.toHaveBeenCalled();
});

test('removing the optional primary charge voids the old commission without generating a replacement', async () => {
  const correction = jest.fn(), ctx = { tx: {}, eventPublisher: {} };
  const execute = createCorrectCheckoutCommissionUseCase({ commissionRepository: { lockByAppointment: async () => ({ id: 'commission', resolvedPrice: 50000, completedAt: new Date() }) }, voidCommission: correction, businessDayGate: { acquire: jest.fn() } });
  await execute({ tenantId: 'tenant', appointmentId: 'visit', servicePrice: null, actor: { actorId: 'cashier' } }, ctx);
  expect(correction).toHaveBeenCalledWith(expect.objectContaining({ commissionId: 'commission', replacement: null }), ctx);
});
test('the existing immutable correction command is invoked only when the primary amount changes, in the payment transaction', async () => {
  const correction = jest.fn(); const ctx = { tx: {}, eventPublisher: {} };
  const execute = createCorrectCheckoutCommissionUseCase({ commissionRepository: { lockByAppointment: async () => ({ id: 'commission', resolvedPrice: 95000, completedAt: new Date() }) }, voidCommission: correction, businessDayGate: { acquire: jest.fn() } });
  const input = { tenantId: 'tenant', appointmentId: 'appointment', servicePrice: 95000, actor: { actorId: 'staff:cashier' } };
  await execute(input, ctx); expect(correction).not.toHaveBeenCalled();
  await execute({ ...input, servicePrice: 100000 }, ctx);
  expect(correction).toHaveBeenCalledWith(expect.objectContaining({ commissionId: 'commission', replacement: { resolvedPrice: 100000 } }), ctx);
});
