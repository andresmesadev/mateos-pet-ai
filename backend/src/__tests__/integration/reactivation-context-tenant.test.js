const express = require('express');
const request = require('supertest');
jest.mock('../../lib/prisma', () => ({}));
jest.mock('../../services/next-action.service', () => ({}));
jest.mock('../../services/dashboard-reactivation.service', () => ({ reactivationContext: jest.fn() }));
const { reactivationContext } = require('../../services/dashboard-reactivation.service');
const routes = require('../../routes/dashboard/clients.routes');
const app = express();
app.use(express.json(), (req, res, next) => {
  req.tenant = { tenantId: 'tenant-authenticated' };
  req.access = { activeModules: req.headers['x-test-no-grooming'] ? ['retail'] : ['grooming'] };
  next();
}, routes);
app.use((err, req, res, next) => { res.status(500).json({ error: 'unavailable' }); });
beforeEach(() => { jest.resetAllMocks(); });

test('preview uses authenticated tenant, never body or query overrides', async () => {
  reactivationContext.mockResolvedValue({ ready: true, preview: 'Centro autorizado' });
  const response = await request(app).get('/campaigns/reactivation/context?tenantId=foreign').send({ tenantId: 'foreign' });
  expect(response.status).toBe(200); expect(response.body.preview).toBe('Centro autorizado');
  expect(reactivationContext).toHaveBeenCalledWith('tenant-authenticated');
});
test('module guard applies before loading preview', async () => {
  expect((await request(app).get('/campaigns/reactivation/context').set('x-test-no-grooming', 'yes')).status).toBe(403);
  expect(reactivationContext).not.toHaveBeenCalled();
});
test('asynchronous context errors reach the error handler', async () => {
  reactivationContext.mockRejectedValue(new Error('database unavailable'));
  expect((await request(app).get('/campaigns/reactivation/context')).status).toBe(500);
});
