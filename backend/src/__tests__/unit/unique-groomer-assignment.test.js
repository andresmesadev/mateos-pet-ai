jest.mock('../../lib/prisma', () => ({}));
const { uniqueGroomer, assignmentReason } = require('../../services/staff-scheduling.service');
const { createCompleteAppointmentUseCase } = require('../../contexts/agenda/application/use-cases/complete-appointment.usecase');
const args = { tenantId: 'clinic', serviceId: 'bath', serviceType: 'grooming', date: new Date('2026-10-19T15:00:00Z'), appointmentId: 'visit' };
function setup(staff = []) {
  const service = { id: 'bath', category: { name: 'grooming' }, duration: 60 };
  const rows = staff.map(s => ({ tenantId: 'clinic', role: 'groomer', active: true, serviceScope: 'role', capabilities: [], availabilities: [], ...s }));
  const db = { $queryRaw: jest.fn(), service: { findFirst: jest.fn(async () => service) },
    staff: { findMany: jest.fn(async () => rows.filter(s => s.active && s.role === 'groomer' && s.tenantId === 'clinic')), findFirst: jest.fn(async ({ where }) => rows.find(s => s.id === where.id && s.tenantId === where.tenantId) ?? null) },
    appointment: { findMany: jest.fn(async () => []) } };
  return { db, rows, service };
}
test('a unique eligible groomer is locked and assigned, scoped to the clinic', async () => {
  const { db } = setup([{ id: 'only', name: 'Peluquera' }]);
  expect(await uniqueGroomer(db, args, true)).toBe('only'); expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  expect(db.staff.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'clinic', role: 'groomer', active: true } }));
});
test('two eligible groomers require an explicit choice without selecting the first', async () => {
  const { db } = setup([{ id: 'a' }, { id: 'b' }]);
  await expect(uniqueGroomer(db, args, true)).rejects.toMatchObject({ code: 'STAFF_SELECTION_REQUIRED', choices: expect.arrayContaining([expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })]) });
  expect(db.$queryRaw).not.toHaveBeenCalled(); expect(await uniqueGroomer(db, args)).toBeNull();
});
test.each([
  { active: false }, { tenantId: 'other' }, { role: 'vet' }, { serviceScope: 'selected', capabilities: [] },
  { availabilities: [{ type: 'unplanned_absence', startAt: new Date('2026-10-19T14:00:00Z'), endAt: new Date('2026-10-19T17:00:00Z') }] },
])('ineligible/absent staff is never assigned: %j', async data => {
  const { db } = setup([{ id: 'excluded', ...data }]);
  expect(await uniqueGroomer(db, args)).toBeNull(); await expect(uniqueGroomer(db, args, true)).rejects.toMatchObject({ code: 'STAFF_UNAVAILABLE' });
});
test('overlapping attention excludes the only groomer and unrelated veterinary appointments stay unchanged', async () => {
  const { db, service } = setup([{ id: 'busy' }]);
  db.appointment.findMany.mockResolvedValue([{ date: args.date, service: { duration: 60 } }]);
  expect(await uniqueGroomer(db, args)).toBeNull();
  service.category.name = 'veterinary'; expect(await uniqueGroomer(db, args, true)).toBeNull();
});

test('one groomer receives grooming every 20 minutes despite a 60-minute catalogue duration', async () => {
  const { db } = setup([{ id: 'only' }]);
  db.appointment.findMany.mockResolvedValue([{ date: new Date(args.date.getTime() - 20 * 60000), serviceType: 'grooming', service: { duration: 60, category: { name: 'grooming' } } }]);
  expect(await uniqueGroomer(db, args, true)).toBe('only');
  db.appointment.findMany.mockResolvedValue([{ date: new Date(args.date.getTime() - 19 * 60000), serviceType: 'grooming', service: { duration: 60 } }]);
  expect(await uniqueGroomer(db, args)).toBeNull();
});

test('veterinary resource occupancy still uses the full catalogue duration', async () => {
  const { db, rows } = setup([{ id: 'vet', role: 'vet' }]);
  const service = { id: 'consult', duration: 60, category: { name: 'veterinary' } };
  db.appointment.findMany.mockResolvedValue([{ date: new Date(args.date.getTime() - 20 * 60000), serviceType: 'vet', service }]);
  expect(rows[0].role).toBe('vet');
  expect(await assignmentReason(db, { ...args, staffId: 'vet', service, serviceType: 'vet' })).toMatch(/ya tiene/);
});
test('completion assigns before publishing the event that records commission and charge', async () => {
  const appointment = { id: 'visit', tenantId: 'clinic', status: 'in_progress', staffId: null };
  const repository = { findById: jest.fn(async () => appointment), assignStaff: jest.fn(async (_tenant, _id, staffId) => ({ ...appointment, staffId })), markCompleted: jest.fn(async () => ({ ...appointment, status: 'completed' })) };
  const publisher = { publish: jest.fn() };
  const execute = createCompleteAppointmentUseCase({ appointmentRepository: repository, priceResolution: { resolve: () => ({ finalPrice: 50000, source: 'pet_default_price' }) }, unitOfWork: { run: fn => fn({ tx: {} }) }, eventPublisher: publisher, staffAssignment: { resolve: async () => 'only' } });
  await execute({ tenantId: 'clinic', appointmentId: 'visit' });
  expect(repository.assignStaff).toHaveBeenCalled(); expect(publisher.publish).toHaveBeenCalledWith('CitaCompletada', expect.objectContaining({ staffId: 'only', resolvedPrice: 50000 }), expect.anything());
});
