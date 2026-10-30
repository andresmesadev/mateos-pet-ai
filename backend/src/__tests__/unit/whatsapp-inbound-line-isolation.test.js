jest.mock('../../services/whatsapp.service', () => ({ parseIncomingMessage: jest.fn() }));
jest.mock('../../lib/prisma', () => ({ tenant: { findUnique: jest.fn() }, whatsAppConnection: { findUnique: jest.fn().mockResolvedValue(null) } }));
const { parseIncomingMessage } = require('../../services/whatsapp.service');
const db = require('../../lib/prisma');
const { resolveTenantId } = require('../../contexts/receptionist/infrastructure/engine/resolve-tenant-id');
const originalEnv = process.env;
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, WHATSAPP_ENABLED: 'true', WHATSAPP_PHONE_NUMBER_ID: '100001', WHATSAPP_ACCESS_TOKEN: 'synthetic-only' };
  parseIncomingMessage.mockReturnValue({ phoneNumberId: '100001' });
  db.tenant.findUnique.mockImplementation(async ({ where }) => where.phone === '100001' || where.id === 'tenant-a' ? { id: 'tenant-a', active: true, phone: '100001' } : null);
});
afterEach(() => { process.env = originalEnv; });
test('only the configured receiving line can resolve its active tenant', async () => {
  await expect(resolveTenantId({})).resolves.toBe('tenant-a');
  expect(db.tenant.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { phone: '100001' } }));
});
test.each(['100002', '', null, undefined, ' 100001'])('another or absent receiver %s is rejected before tenant lookup', async phoneNumberId => {
  parseIncomingMessage.mockReturnValue({ phoneNumberId });
  await expect(resolveTenantId({})).resolves.toBeNull();

});
test('missing line configuration and global pause do not route inbound processing', async () => {
  delete process.env.WHATSAPP_PHONE_NUMBER_ID; await expect(resolveTenantId({})).resolves.toBeNull();
  process.env.WHATSAPP_PHONE_NUMBER_ID = '100001'; process.env.WHATSAPP_ENABLED = 'false';
  await expect(resolveTenantId({})).resolves.toBeNull();
});
test('inactive or unresolved tenant is never delegated to the engine', async () => {
  for (const value of [null, { id: 'tenant-a', active: false }]) { db.tenant.findUnique.mockResolvedValue(value); await expect(resolveTenantId({})).resolves.toBeNull(); }
  db.tenant.findUnique.mockRejectedValue(Error('unavailable')); await expect(resolveTenantId({})).resolves.toBeNull();
});
