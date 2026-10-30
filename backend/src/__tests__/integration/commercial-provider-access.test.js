const express = require('express'), request = require('supertest');
jest.mock('../../lib/prisma', () => ({ tenant: { findUnique: jest.fn() }, staffCredential: { findFirst: jest.fn() } }));
jest.mock('../../services/ai-quota.service', () => ({ status: jest.fn(), setLimit: jest.fn(), reconcile: jest.fn() }));
jest.mock('../../services/whatsapp-connections.service', () => ({ buildWhatsAppConnections: jest.fn() }));
const db = require('../../lib/prisma'), ai = require('../../services/ai-quota.service');
const { buildWhatsAppConnections } = require('../../services/whatsapp-connections.service');
const { requireInternalToken } = require('../../middleware/requireInternalToken');
const router = require('../../routes/integrations.routes');
const original = process.env;
let connections;
function app() { const server = express(); server.use(express.json()); server.use('/api/integrations',requireInternalToken,router); return server; }
const staff = { 'X-Internal-Token': 'synthetic-internal', 'X-Staff-Id': 'staff-a', 'X-Staff-Session-Version': '2', 'X-Tenant-Id': 'a' };
const root = { 'X-Internal-Token': 'synthetic-internal', 'X-Super-Admin': 'true', 'X-Admin-Email': 'admin@example.invalid', 'X-Tenant-Id': 'b' };
beforeEach(() => {
  jest.clearAllMocks(); process.env = { ...original, NODE_ENV: 'production', INTERNAL_API_SECRET: 'synthetic-internal', SINGLE_TENANT_ID: 'legacy-a' };
  db.tenant.findUnique.mockResolvedValue({ active: true });
  db.staffCredential.findFirst.mockImplementation(async ({ where }) => where.staffId === 'staff-a' && where.sessionVersion === 2 && where.staff.tenantId === 'a' ? { staffId: 'staff-a', staff: { name: 'Synthetic', role: 'admin' } } : null);
  connections = { status: jest.fn(async () => ({})), start: jest.fn(async () => ({})), complete: jest.fn(async () => ({})), disconnect: jest.fn(async () => ({})) };
  buildWhatsAppConnections.mockReturnValue(connections); ai.status.mockResolvedValue({}); ai.setLimit.mockResolvedValue({ saved: true }); ai.reconcile.mockResolvedValue({ saved: true });
});
afterEach(() => { process.env = original; });
test('an unauthenticated client cannot reach integrations using forged identity headers', async () => {
  const res = await request(app()).get('/api/integrations/status').set({ 'X-Super-Admin': 'true','X-Tenant-Id': 'b' });
  expect(res.status).toBe(401); expect(connections.status).not.toHaveBeenCalled();
});
test('ordinary administrators can read only their current membership, never a body tenant', async () => {
  const res = await request(app()).post('/api/integrations/whatsapp/start').set(staff).send({ tenantId: 'b' });
  expect(res.status).toBe(200); expect(connections.start).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'a' }));
  const foreign = await request(app()).get('/api/integrations/status').set({ ...staff,'X-Tenant-Id': 'b' }); expect(foreign.status).toBe(403);
});
test.each(['vet','groomer','receptionist'])('the professional role %s cannot administer provider connections', async role => {
  db.staffCredential.findFirst.mockResolvedValue({ staffId: 'staff-a', staff: { role } });
  expect((await request(app()).post('/api/integrations/whatsapp/start').set(staff).send({})).status).toBe(403);
});
test('a revoked session is rejected before integration operations', async () => {
  expect((await request(app()).get('/api/integrations/status').set({ ...staff,'X-Staff-Session-Version': '1' })).status).toBe(403);
  expect(connections.status).not.toHaveBeenCalled();
});
test('an establishment administrator cannot increase its own allowance or reconcile usage', async () => {
  for (const path of ['limit','reconcile']) expect((await request(app()).post('/api/integrations/ai/'+path).set(staff).send({ monthlyLimit: 999999 })).status).toBe(403);
  expect(ai.setLimit).not.toHaveBeenCalled(); expect(ai.reconcile).not.toHaveBeenCalled();
});
test('platform administration targets the explicit tenant even in legacy single-tenant mode', async () => {
  expect((await request(app()).post('/api/integrations/ai/limit').set(root).send({ monthlyLimit: 12, tenantId: 'other' })).status).toBe(200);
  expect(ai.setLimit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'b', monthlyLimit: 12 }));
});
test('suspended establishments fail closed and provider errors are redacted', async () => {
  db.tenant.findUnique.mockResolvedValue({ active: false });
  expect((await request(app()).get('/api/integrations/status').set(root)).status).toBe(402);
  db.tenant.findUnique.mockResolvedValue({ active: true }); connections.complete.mockRejectedValue(Error('secret-token'));
  const res = await request(app()).post('/api/integrations/whatsapp/complete').set(root).send({ code: 'private-code' });
  expect(res.status).toBe(503); expect(JSON.stringify(res.body)).not.toMatch(/secret-token|private-code/);
});
