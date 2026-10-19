const { createSettleSystemChargeUseCase } = require('../application/use-cases/pos/settle-system-charge.usecase');

const now = new Date('2026-10-18T15:00:00Z');
const actor = { id: 'staff:cashier', name: 'Caja ficticia', role: 'receptionist' };
function build(overrides = {}) {
  const charge = { id: 'charge-a', tenantId: 'tenant-a', appointmentId: 'appointment-a', total: 103000, paidAt: null, paymentMethod: 'cash', notes: null, recordedActorId: null, ...overrides };
  const repository = { lockByAppointment: jest.fn(async () => charge), findActiveByAppointment: jest.fn(async () => charge), settle: jest.fn(async (_id, data) => { Object.assign(charge, data, data.recordedBy ? { recordedActorId: data.recordedBy.id } : {}); return charge; }) };
  const publisher = { publish: jest.fn() }, gate = { acquire: jest.fn() }, dailyClose = { findByDate: jest.fn().mockResolvedValue(null) };
  const execute = createSettleSystemChargeUseCase({ transactionRepository: repository, eventPublisher: publisher, businessDayGate: gate, dailyCloseRepository: dailyClose, clock: () => now });
  const input = { tenantId: 'tenant-a', appointmentId: 'appointment-a', paymentMethod: 'cash', notes: null, recordedBy: actor };
  return { execute, input, charge, repository, publisher, gate, dailyClose, ctx: { tx: {} } };
}
test('paying on a later day records the actual confirmation date without changing the amount', async () => {
  const s = build(); await s.execute(s.input, s.ctx);
  expect(s.charge.paidAt).toBe(now); expect(s.charge.total).toBe(103000);
  expect(s.repository.lockByAppointment).toHaveBeenCalledWith('tenant-a', 'appointment-a', s.ctx);
  expect(s.gate.acquire).toHaveBeenCalledWith('tenant-a', '2026-10-18', s.ctx);
  expect(s.publisher.publish).toHaveBeenCalledTimes(1);
});
test('a repeat confirmation returns the same payment, timestamp and single event', async () => {
  const s = build(); await s.execute(s.input, s.ctx); await s.execute(s.input, s.ctx);
  expect(s.repository.settle).toHaveBeenCalledTimes(1); expect(s.publisher.publish).toHaveBeenCalledTimes(1); expect(s.charge.paidAt).toBe(now);
});
test('a conflicting second confirmation cannot replace the original payment', async () => {
  const s = build(); await s.execute(s.input, s.ctx);
  await expect(s.execute({ ...s.input, paymentMethod: 'transfer' }, s.ctx)).rejects.toThrow('ya fue confirmado');
  expect(s.charge.paymentMethod).toBe('cash'); expect(s.repository.settle).toHaveBeenCalledTimes(1);
});
test('a closed business day blocks a pending payment without writing or publishing', async () => {
  const s = build(); s.dailyClose.findByDate.mockResolvedValue({ id: 'close-a' });
  await expect(s.execute(s.input, s.ctx)).rejects.toThrow('cierre oficial');
  expect(s.repository.settle).not.toHaveBeenCalled(); expect(s.publisher.publish).not.toHaveBeenCalled();
});
test('pending payments require method and authenticated operator identity', async () => {
  const s = build();
  await expect(s.execute({ ...s.input, recordedBy: { id: null } }, s.ctx)).rejects.toThrow('operador');
  await expect(s.execute({ ...s.input, paymentMethod: undefined }, s.ctx)).rejects.toThrow('operador');
  expect(s.repository.settle).not.toHaveBeenCalled();
});
test('legacy payment review preserves its original date and does not reopen cash income', async () => {
  const old = new Date('2026-09-01T15:00:00Z'), s = build({ paidAt: old });
  await s.execute({ ...s.input, paymentMethod: 'transfer' }, s.ctx);
  expect(s.charge.paidAt).toBe(old); expect(s.gate.acquire).not.toHaveBeenCalled();
  expect(s.repository.settle.mock.calls[0][1]).not.toHaveProperty('paidAt');
});
test('a foreign charge is rejected before writing', async () => {
  const s = build({ tenantId: 'tenant-other' });
  await expect(s.execute(s.input, s.ctx)).rejects.toThrow(); expect(s.repository.settle).not.toHaveBeenCalled();
});
