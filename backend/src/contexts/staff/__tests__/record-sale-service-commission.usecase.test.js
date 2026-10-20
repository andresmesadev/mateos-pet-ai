const { createRecordSaleServiceCommissionUseCase } = require('../application/use-cases/record-sale-service-commission.usecase');
function fixture() {
  const paidAt = new Date('2026-10-19T20:00:00Z');
  const item = { id: 'line', itemKind: 'service', appointmentComponent: null, serviceId: 'service', performedByStaffId: 'person', total: '28000', transaction: { status: 'active', paidAt } };
  const person = { id: 'person', tenantId: 'tenant', active: true, role: 'groomer', contractType: 'service', commissionRate: .5 };
  const category = { id: 'category', name: 'grooming', appliesCommissionSplit: true };
  const deps = {
    sourceReader: { lockItem: jest.fn(async () => item), service: jest.fn(async () => ({ active: true })), capabilities: jest.fn(async () => []) }, staffRepository: { findById: jest.fn(async () => person) }, serviceCategoryReader: { getCategoryForService: jest.fn(async () => category) }, businessConfigReader: { getCommissionSplitRate: jest.fn(async () => .5) },
    commissionRepository: { findByItem: jest.fn(async () => null), create: jest.fn(async data => ({ id: 'commission', ...data })) }, dailyCloseReader: { findByCivilDay: jest.fn(async () => null) }, settlementCoverageReader: { findActiveCovering: jest.fn(async () => null) }, businessDayGate: { acquire: jest.fn() }, staffFinanceGate: { acquire: jest.fn() }
  };
  const ctx = { tx: {}, eventPublisher: { publish: jest.fn() } };
  const input = { tenantId: 'tenant', transactionItemId: 'line', serviceId: 'service', staffId: 'person' };
  return { deps, ctx, input, item, person, category, run: createRecordSaleServiceCommissionUseCase(deps) };
}
test('paid extra freezes its total and personal rate independently of the principal appointment', async () => {
  const f = fixture(); const c = await f.run(f.input, f.ctx);
  expect(c).toMatchObject({ appointmentId: null, transactionItemId: 'line', serviceId: 'service', staffId: 'person', resolvedPrice: 28000, splitRate: .5, staffShare: 14000, businessShare: 14000, completedAt: f.item.transaction.paidAt });
  expect(f.deps.serviceCategoryReader.getCategoryForService).toHaveBeenCalledWith('service', 'tenant', f.ctx);
  expect(f.ctx.eventPublisher.publish).toHaveBeenCalledTimes(1);
});
test.each(['product', 'principal', 'transport', 'voided', 'unpaid'])('%s cannot generate an extra commission', async kind => {
  const f = fixture();
  if (kind === 'product') f.item.itemKind = 'product';
  if (kind === 'principal') f.item.appointmentComponent = 'service';
  if (kind === 'transport') f.item.appointmentComponent = 'transport';
  if (kind === 'voided') f.item.transaction.status = 'voided';
  if (kind === 'unpaid') f.item.transaction.paidAt = null;
  await expect(f.run(f.input, f.ctx)).rejects.toThrow(); expect(f.deps.commissionRepository.create).not.toHaveBeenCalled();
});
test('direct service has no commission; fixed professional has zero share', async () => {
  const f = fixture(); f.category.appliesCommissionSplit = false; f.item.performedByStaffId = null;
  expect(await f.run({ ...f.input, staffId: null }, f.ctx)).toBeNull();
  f.category.appliesCommissionSplit = true; f.item.performedByStaffId = 'person'; f.person.contractType = 'fixed'; f.person.commissionRate = null;
  expect(await f.run(f.input, f.ctx)).toMatchObject({ staffShare: 0, businessShare: 28000 });
});
test('legacy explicit link requires reason, preserves receipt and retries without duplicating or changing a frozen rate', async () => {
  const f = fixture(); f.item.serviceId = null; f.item.performedByStaffId = null; const original = structuredClone(f.item);
  await expect(f.run(f.input, f.ctx)).rejects.toThrow();
  await expect(f.run({ ...f.input, historicalReason: '' }, f.ctx)).rejects.toThrow();
  const c = await f.run({ ...f.input, historicalReason: 'Responsable confirmó ambos servicios' }, f.ctx);
  expect(c.staffShare).toBe(14000); expect(f.item).toEqual(original);
  f.deps.commissionRepository.findByItem.mockResolvedValue(c); f.person.commissionRate = .7;
  expect(await f.run({ ...f.input, historicalReason: 'Reintento' }, f.ctx)).toEqual(c);
  expect(f.deps.commissionRepository.create).toHaveBeenCalledTimes(1);
});
test.each(['closed', 'settled', 'foreignStaff', 'inactiveStaff', 'foreignService', 'retiredService', 'missingStaff', 'wrongArea', 'emptyScope', 'disabledArea'])('%s blocks the write', async kind => {
  const f = fixture();
  if (kind === 'closed') f.deps.dailyCloseReader.findByCivilDay.mockResolvedValue({});
  if (kind === 'settled') f.deps.settlementCoverageReader.findActiveCovering.mockResolvedValue({ id: 'settlement' });
  if (kind === 'foreignStaff') f.person.tenantId = 'foreign';
  if (kind === 'inactiveStaff') f.person.active = false;
  if (kind === 'foreignService') f.deps.sourceReader.service.mockResolvedValue(null);
  if (kind === 'retiredService') f.deps.sourceReader.service.mockResolvedValue({ active: false });
  if (kind === 'missingStaff') { f.item.performedByStaffId = null; f.input.staffId = null; }
  if (kind === 'wrongArea') f.person.role = 'vet';
  if (kind === 'emptyScope') f.person.serviceScope = 'selected';
  if (kind === 'disabledArea') f.input.activeModules = ['veterinary'];
  await expect(f.run(f.input, f.ctx)).rejects.toThrow(); expect(f.deps.commissionRepository.create).not.toHaveBeenCalled();
});
test('33.33 percent and quantities use the paid line total, not the mutable catalogue price', async () => {
  const f = fixture(); f.person.commissionRate = .3333; f.item.total = '56000';
  expect(await f.run(f.input, f.ctx)).toMatchObject({ resolvedPrice: 56000, splitRate: .3333, staffShare: 18664.8, businessShare: 37335.2 });
});
