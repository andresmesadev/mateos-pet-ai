const { createCompleteAppointmentUseCase } = require('../application/use-cases/complete-appointment.usecase');
const { resolveAppointmentTotal } = require('../../../services/domain/price-resolver.service');
const { mapAppointmentRow } = require('../../../routes/dashboard/shared');

function setup(category = 'other', basePrice = null) {
  const appointment = { id: 'visit', tenantId: 'clinic', petId: 'pet', serviceId: 'service', staffId: 'vet',
    status: 'in_progress', serviceType: 'vet', finalPrice: null, transportMode: 'none',
    pet: { defaultGroomingPrice: 80000 }, service: { basePrice, category: { name: category } } };
  const repository = { findById: jest.fn(async () => appointment), lockAndFindById: jest.fn(async () => appointment),
    markCompleted: jest.fn(async (_id, endedAt, finalPrice) => ({ ...appointment, status: 'completed', endedAt, finalPrice })) };
  const publisher = { publish: jest.fn() }, ctx = { tx: {} };
  const execute = createCompleteAppointmentUseCase({ appointmentRepository: repository, priceResolution: { resolve: resolveAppointmentTotal }, unitOfWork: { run: fn => fn(ctx) }, eventPublisher: publisher });
  return { appointment, repository, publisher, execute, ctx };
}

test.each(['other', 'veterinary'])('%s can complete unvalued without using the pet grooming tariff or inventing zero', async category => {
  const s = setup(category);
  const result = await s.execute({ tenantId: 'clinic', appointmentId: 'visit' });
  expect(result.appointment).toMatchObject({ status: 'completed', finalPrice: null });
  expect(s.publisher.publish).toHaveBeenCalledWith('CitaCompletada', expect.objectContaining({ resolvedPrice: null, priceDeferred: true }), s.ctx);
  expect(mapAppointmentRow({ ...result.appointment, transactions: [] }).payment).toMatchObject({ status: 'pending', transactionId: null });
});

test.each([60000, 0])('configured non-grooming price %s still creates the usual priced completion', async price => {
  const s = setup('other', price);
  const result = await s.execute({ tenantId: 'clinic', appointmentId: 'visit' });
  expect(result.appointment.finalPrice).toBe(price);
  expect(s.publisher.publish.mock.calls[0][1]).not.toHaveProperty('priceDeferred');
});

test('service category overrides a misleading legacy grooming type', async () => {
  const s = setup(); s.appointment.serviceType = 'grooming';
  expect((await s.execute({ tenantId: 'clinic', appointmentId: 'visit' })).appointment.finalPrice).toBeNull();
});

test('grooming still rejects an unresolved price before any write', async () => {
  const s = setup('grooming'); s.appointment.pet.defaultGroomingPrice = null;
  await expect(s.execute({ tenantId: 'clinic', appointmentId: 'visit' })).rejects.toThrow(/peluquería/);
  expect(s.repository.markCompleted).not.toHaveBeenCalled(); expect(s.publisher.publish).not.toHaveBeenCalled();
});

test('price and category are rechecked after locking the appointment', async () => {
  const s = setup();
  s.repository.lockAndFindById.mockResolvedValue({ ...s.appointment, pet: {}, service: { category: { name: 'grooming' }, basePrice: null } });
  await expect(s.execute({ tenantId: 'clinic', appointmentId: 'visit' })).rejects.toThrow();
  expect(s.repository.markCompleted).not.toHaveBeenCalled();
});

test('a deferred completed visit remains unvalued after a catalogue price edit', () => {
  const s = setup('veterinary', 60000);
  expect(resolveAppointmentTotal({ ...s.appointment, status: 'completed' }).finalPrice).toBeNull();
  expect(resolveAppointmentTotal({ ...s.appointment, status: 'completed', finalPrice: 50000 }).finalPrice).toBe(50000);
});
