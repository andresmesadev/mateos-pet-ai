jest.mock('../../../lib/prisma', () => ({ service: { findFirst: jest.fn() } }));
const prisma = require('../../../lib/prisma');
const { PrismaServiceCategoryReader } = require('../infrastructure/persistence/prisma-service-category.reader');
beforeEach(() => jest.clearAllMocks());
test.each([[false, true, false], [true, false, true], [null, true, true], [null, false, false]])('service %p overrides category %p and resolves %p', async (individual, categoryFlag, expected) => {
  const tx = { service: { findFirst: jest.fn().mockResolvedValue({ appliesCommissionSplit: individual, category: { id: 'cat-a', name: 'grooming', appliesCommissionSplit: categoryFlag } }) } };
  const row = await new PrismaServiceCategoryReader().getCategoryForService('svc-a', 'tenant-a', { tx });
  expect(row.appliesCommissionSplit).toBe(expected);
  expect(tx.service.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'svc-a', tenantId: 'tenant-a' } }));
  expect(prisma.service.findFirst).not.toHaveBeenCalled();
});
test('foreign service is absent in the scoped reader', async () => {
  prisma.service.findFirst.mockResolvedValue(null);
  expect(await new PrismaServiceCategoryReader().getCategoryForService('foreign', 'tenant-a')).toBeNull();
});
