jest.mock('../lib/prisma', () => ({ $queryRaw: jest.fn(), user: { findMany: jest.fn() } }));
const prisma = require('../lib/prisma');
const { listInactiveClientsPage } = require('../services/dashboard-inactive-clients.service');
beforeEach(() => {
  jest.clearAllMocks();
  prisma.$queryRaw.mockResolvedValueOnce([{ total: 521 }]).mockResolvedValueOnce([{ id: 'owner-a', lastVisitDate: new Date('2026-06-01T12:00:00Z') }]);
  prisma.user.findMany.mockResolvedValue([{ id: 'owner-a', name: 'Ana', phone: '573001234567', lastReminderSentAt: null, pets: [{ id: 'pet-a', name: 'Luna', type: 'dog' }] }]);
});
test('paginates all matching clients, scopes SQL and hydration, and orders by last visit', async () => {
  const result = await listInactiveClientsPage('tenant-a', { page: '26' });
  expect(result).toMatchObject({ total: 521, page: 26, totalPages: 27, pageSize: 20 });
  expect(result.data[0]).toMatchObject({ id: 'owner-a', lastVisitDate: '2026-06-01T12:00:00.000Z' });
  const sql = prisma.$queryRaw.mock.calls[1][0];
  expect(sql.text).toContain('MAX(r.date)'); expect(sql.text).toContain('ORDER BY "lastVisitDate" ASC NULLS LAST, u.id ASC');
  expect(sql.values).toEqual(expect.arrayContaining(['tenant-a', 20, 500]));
  expect(prisma.user.findMany.mock.calls[0][0]).toMatchObject({ where: { tenantId: 'tenant-a' }, select: { pets: { where: { tenantId: 'tenant-a' } } } });
});
test('search and date filters are bound values and respect inclusive Bogotá days', async () => {
  await listInactiveClientsPage('tenant-a', { search: "% Luna' OR 1=1 --", contact: 'recorded', contactFrom: '2026-10-01', contactTo: '2026-10-05' });
  const sql = prisma.$queryRaw.mock.calls[0][0];
  expect(sql.text).not.toContain("OR 1=1 --"); expect(sql.text).toContain('sp.name ILIKE');
  expect(sql.values).toEqual(expect.arrayContaining([new Date('2026-10-01T05:00:00Z'), new Date('2026-10-06T05:00:00Z'), "%\\% Luna' OR 1=1 --%"]));
});
test('filters clients without contact and clamps invalid pages and excessive limits', async () => {
  const result = await listInactiveClientsPage('tenant-a', { contact: 'never', page: '999', limit: '999' });
  expect(prisma.$queryRaw.mock.calls[0][0].text).toContain('"lastReminderSentAt" IS NULL');
  expect(result).toMatchObject({ pageSize: 500, totalPages: 2, page: 2 });
});
test('empty result has one empty page and skips hydration', async () => {
  prisma.$queryRaw.mockReset().mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
  expect(await listInactiveClientsPage('tenant-a')).toEqual({ data: [], total: 0, page: 1, totalPages: 1, pageSize: 20 });
  expect(prisma.user.findMany).not.toHaveBeenCalled();
});
test.each([{ contactFrom: '2026-02-30' }, { contactTo: 'invalid' }, { contactFrom: '2026-10-06', contactTo: '2026-10-05' }])('rejects invalid contact date range before reading database: %p', async query => {
  await expect(listInactiveClientsPage('tenant-a', query)).rejects.toMatchObject({ status: 400 });
  expect(prisma.$queryRaw).not.toHaveBeenCalled();
});
