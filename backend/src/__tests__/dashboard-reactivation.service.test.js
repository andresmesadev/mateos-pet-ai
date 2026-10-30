jest.mock('../lib/prisma', () => ({ user: { findMany: jest.fn(), update: jest.fn() } }));
jest.mock('../services/reactivation-template.service', () => ({ reactivationContext: jest.fn(), sendReactivationTemplate: jest.fn() }));
const prisma = require('../lib/prisma');
const template = require('../services/reactivation-template.service');
const { sendReactivationCampaign, reactivationContext } = require('../services/dashboard-reactivation.service');
const original = { ...process.env };
beforeEach(() => { jest.clearAllMocks(); template.reactivationContext.mockResolvedValue({ ready: true }); template.sendReactivationTemplate.mockResolvedValue(true); prisma.user.update.mockResolvedValue({}); prisma.user.findMany.mockResolvedValue([{ id: 'a', name: 'Ana', phone: '573001234567' }]); });
afterAll(() => { process.env = original; });
test('configuration is visible and missing channel blocks before recipients or messages', async () => {
  template.reactivationContext.mockResolvedValue({ ready: false, channelConfigured: false, reason: 'Canal no configurado' });
  expect(await reactivationContext('tenant-a')).toMatchObject({ ready: false, channelConfigured: false });
  await expect(sendReactivationCampaign('tenant-a', ['a'])).rejects.toMatchObject({ status: 422 });
  expect(prisma.user.findMany).not.toHaveBeenCalled(); expect(template.sendReactivationTemplate).not.toHaveBeenCalled();
});
test('missing template blocks; no free-text fallback', async () => {
  template.reactivationContext.mockResolvedValue({ ready: false, templateConfigured: false, reason: 'Plantilla no configurada' });
  await expect(sendReactivationCampaign('tenant-a', ['a'])).rejects.toMatchObject({ status: 422 });
  expect(template.sendReactivationTemplate).not.toHaveBeenCalled();
});
test.each([[], null, [''], Array(501).fill('a')])('rejects invalid selections %p', async ids => {
  await expect(sendReactivationCampaign('tenant-a', ids)).rejects.toMatchObject({ status: 400 });
  expect(template.sendReactivationTemplate).not.toHaveBeenCalled();
});
test('requires a selected tenant for outbound contact', async () => {
  await expect(sendReactivationCampaign(null, ['a'])).rejects.toMatchObject({ status: 400 });
  expect(prisma.user.findMany).not.toHaveBeenCalled();
});
test('rejects stale or cross-tenant contacts before sending any', async () => {
  await expect(sendReactivationCampaign('tenant-a', ['a', 'other'])).rejects.toMatchObject({ status: 409 });
  expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ tenantId: 'tenant-a', id: { in: ['a', 'other'] } });
  expect(template.sendReactivationTemplate).not.toHaveBeenCalled();
});
test('deduplicates selection and records only confirmed delivery', async () => {
  expect(await sendReactivationCampaign('tenant-a', ['a', 'a'])).toMatchObject({ sent: 1, total: 1 });
  expect(template.sendReactivationTemplate).toHaveBeenCalledTimes(1); expect(prisma.user.update).toHaveBeenCalledTimes(1);
  expect(template.reactivationContext).toHaveBeenCalledWith('tenant-a');
});
test('partial delivery distinguishes sent, failed and omitted recipients', async () => {
  prisma.user.findMany.mockResolvedValue([{ id: 'a', name: 'Ana', phone: '+57 300 1234567' }, { id: 'b', phone: '573009876543' }, { id: 'c', phone: 'NOPHONE-1' }]);
  template.sendReactivationTemplate.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  const result = await sendReactivationCampaign('tenant-a', ['a', 'b', 'c']);
  expect(result).toMatchObject({ sent: 1, failed: 1, noPhone: 1, total: 3 });
  expect(result.recipients.map(x => x.status)).toEqual(['sent', 'failed', 'omitted']);
  expect(prisma.user.update).toHaveBeenCalledTimes(1);
  expect(template.sendReactivationTemplate.mock.calls[0][0].phone).toBe('+573001234567');
});
test('failed contact metric does not label an already sent message as retryable', async () => {
  prisma.user.update.mockRejectedValue(new Error('database unavailable'));
  const result = await sendReactivationCampaign('tenant-a', ['a']);
  expect(result).toMatchObject({ sent: 1, failed: 0 }); expect(result.recipients[0].reason).toMatch(/métrica/);
});
