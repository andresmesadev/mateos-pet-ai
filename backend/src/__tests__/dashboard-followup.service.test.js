jest.mock('../lib/prisma', () => ({ petNextAction: { findMany: jest.fn(), count: jest.fn() }, medicalRecord: { findMany: jest.fn(), count: jest.fn() } }));
const prisma = require('../lib/prisma');
const { readFollowups } = require('../services/dashboard-followup.service');
const pet = { id: 'pet-a', name: 'Luna', type: 'dog', owner: { id: 'owner-a', name: 'Ana', phone: '573001234567', conversations: [{ id: 'chat-a' }] } };
const action = (id, day) => ({ id, type: 'control', dueAt: new Date(`2026-10-${String(day).padStart(2, '0')}T10:00:00Z`), pet, notes: 'Revisar' });
const record = (id, day) => ({ ...action(id, day), nextControlAt: action(id, day).dueAt, title: 'Control anterior' });
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date('2026-10-05T15:00:00Z'));
  prisma.petNextAction.findMany.mockImplementation(async q => q.select ? [{ sourceRecordId: 'linked-closed' }] : [action('action-a', 4)]);
  prisma.petNextAction.count.mockResolvedValue(1); prisma.medicalRecord.count.mockResolvedValue(1);
  prisma.medicalRecord.findMany.mockResolvedValue([record('record-a', 6)]);
});
afterEach(() => jest.useRealTimers());
test('merges canonical and unlinked legacy dates; includes conversation and ownership', async () => {
  const data = await readFollowups('tenant-a', ['veterinary']);
  expect(data.total).toBe(2);
  expect(data.byType.control.map(x => [x.actionId, x.source, x.isOverdue])).toEqual([['action-a', 'action', true], ['record-a', 'record', false]]);
  expect(data.byType.control[0]).toMatchObject({ ownerId: 'owner-a', conversationId: 'chat-a', petId: 'pet-a' });
});
test('closed source associations also suppress their old record, scoped to tenant', async () => {
  await readFollowups('tenant-a', ['veterinary']);
  expect(prisma.petNextAction.findMany.mock.calls[0][0].where).toEqual({ tenantId: 'tenant-a', sourceRecordId: { not: null } });
  expect(prisma.medicalRecord.count.mock.calls[0][0].where).toMatchObject({ pet: { tenantId: 'tenant-a' }, reminderSent: false, id: { notIn: ['linked-closed'] } });
  expect(prisma.petNextAction.count.mock.calls[0][0].where).toMatchObject({ tenantId: 'tenant-a', status: 'pending', pet: { tenantId: 'tenant-a' } });
});
test('module, search and past-date filters apply to both sources', async () => {
  await readFollowups('tenant-a', ['grooming'], { type: 'grooming', search: ' Ana ', overdue: 'true' });
  const aw = prisma.petNextAction.count.mock.calls[0][0].where, rw = prisma.medicalRecord.count.mock.calls[0][0].where;
  expect(aw.type).toEqual({ in: ['grooming'] }); expect(rw.type).toEqual(aw.type);
  expect(aw.pet.OR[1]).toEqual({ owner: { name: { contains: 'Ana', mode: 'insensitive' } } });
  expect(rw.pet).toEqual(aw.pet); expect(aw.dueAt.lt).toEqual(new Date()); expect(rw.nextControlAt.lt).toEqual(new Date());
});
test('retail-only tenant has no care followups and performs no database reads', async () => {
  expect((await readFollowups('tenant-a', ['retail'])).total).toBe(0);
  expect(prisma.petNextAction.findMany).not.toHaveBeenCalled(); expect(prisma.medicalRecord.count).not.toHaveBeenCalled();
});
test('legacy consultation/deworming dates retain their followup meaning', async () => {
  prisma.medicalRecord.findMany.mockResolvedValue([{ ...record('old-consult', 6), type: 'consultation' }, { ...record('old-deworm', 7), type: 'deworming' }]);
  const data = await readFollowups('tenant-a', ['veterinary']);
  expect(data.byType.control.some(row => row.actionId === 'old-consult')).toBe(true);
  expect(data.byType.treatment[0].actionId).toBe('old-deworm');
  expect(prisma.medicalRecord.count.mock.calls[0][0].where.type.in).toEqual(expect.arrayContaining(['consultation', 'deworming', 'vaccine']));
});
test('paginates the merged streams without gaps or duplicates and clamps pages', async () => {
  const rows = Array.from({ length: 15 }, (_, i) => action(`a-${i}`, i + 1));
  const records = Array.from({ length: 15 }, (_, i) => record(`r-${i}`, i + 1));
  prisma.petNextAction.count.mockResolvedValue(15); prisma.medicalRecord.count.mockResolvedValue(15);
  prisma.petNextAction.findMany.mockImplementation(async q => q.select ? [] : rows.slice(0, q.take));
  prisma.medicalRecord.findMany.mockImplementation(async q => records.slice(0, q.take));
  const first = await readFollowups('tenant-a', ['veterinary'], { page: '1' });
  const second = await readFollowups('tenant-a', ['veterinary'], { page: '999' });
  expect(first.byType.control).toHaveLength(20); expect(second.byType.control).toHaveLength(10); expect(second.page).toBe(2);
  expect(new Set([...first.byType.control, ...second.byType.control].map(x => x.source + x.actionId)).size).toBe(30);
  expect(second.byType.control[0].dueAt).toEqual(action('', 11).dueAt);
});
test('quick filters count all matching rows before pagination and expose relative calendar days', async () => {
  const data = await readFollowups('tenant-a', ['veterinary'], { period: 'today', search: 'Ana' });
  expect(data.periodCounts).toEqual({ all: 2, past: 2, today: 2, next7: 2 });
  const where = prisma.petNextAction.findMany.mock.calls.find(([q]) => q.include)[0].where;
  expect(where.dueAt).toEqual({ gte: new Date('2026-10-05T05:00:00Z'), lt: new Date('2026-10-06T05:00:00Z') });
  expect(data.byType.control.map(row => row.dayOffset)).toEqual([-1, 1]);
  for (const [q] of prisma.petNextAction.count.mock.calls) expect(q.where.pet.OR[1].owner.name.contains).toBe('Ana');
});
