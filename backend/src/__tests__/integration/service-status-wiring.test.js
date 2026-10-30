const express = require('express');
const request = require('supertest');
jest.mock('../../services/business-config.service', () => ({ getActiveModules: jest.fn(async () => ['veterinary', 'grooming', 'retail']) }));
jest.mock('../../services/dashboard-service-status', () => ({ buildDashboardServiceStatus: jest.fn() }));
const { buildDashboardServiceStatus } = require('../../services/dashboard-service-status');
const { allowVeterinaryDashboard } = require('../../middleware/allowVeterinaryDashboard');
const router = require('../../routes/dashboard/service-status.routes');
const status = jest.fn();
function app(role, tenantId = 'own') {
  const server = express(); server.use(express.json());
  server.use((req, _res, next) => { req.tenant = { tenantId }; req.actor = { type: role, role, staffId: 'person' }; next(); });
  server.use('/api/dashboard', allowVeterinaryDashboard, router); return server;
}
beforeEach(() => { jest.clearAllMocks(); buildDashboardServiceStatus.mockReturnValue(status); status.mockResolvedValue({ tenantId: 'own', dashboard: { state: 'responding' } }); });
test.each(['admin', 'vet', 'groomer', 'receptionist'])('summary is readable by %s without granting management access', async role => {
  const server = app(role);
  const result = await request(server).get('/api/dashboard/service-status?tenantId=foreign');
  expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
  expect(status).toHaveBeenCalledWith('own');
  expect((await request(server).post('/api/dashboard/service-status').send({ tenantId: 'foreign' })).status).not.toBe(200);
});
test('query identity cannot select a tenant in platform overview mode', async () => {
  status.mockRejectedValue(Object.assign(new Error('TENANT_REQUIRED'), { status: 403 }));
  const result = await request(app('admin', null)).get('/api/dashboard/service-status?tenantId=foreign');
  expect(status).toHaveBeenCalledWith(null); expect(result.status).toBe(403);
});
test('unexpected failures return generic retry text, not raw database or provider details', async () => {
  status.mockRejectedValue(Error('secret provider token'));
  const result = await request(app('admin')).get('/api/dashboard/service-status');
  expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('secret');
});
