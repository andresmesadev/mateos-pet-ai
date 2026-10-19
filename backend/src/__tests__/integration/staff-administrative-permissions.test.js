const express = require('express');
const request = require('supertest');
jest.mock('../../lib/prisma', () => ({
  tenant: { findUnique: jest.fn() },
  staffCredential: { findFirst: jest.fn() },
}));
const prisma = require('../../lib/prisma');
const { resolveTenant } = require('../../middleware/resolveTenant');
const { allowVeterinaryDashboard } = require('../../middleware/allowVeterinaryDashboard');
const { effectiveAccess, actorSnapshot } = require('../../services/dashboard-access.service');
const { compatibleRole } = require('../../contexts/staff/domain/rules/service-scope.rules');
const staffAuthRoutes = require('../../routes/staff-auth.routes');

const headers = { 'x-tenant-id': 'clinic-a', 'x-staff-id': 'vet-a', 'x-staff-session-version': '1' };
let staff;
beforeEach(() => {
  jest.clearAllMocks();
  staff = { role: 'vet', name: 'Dra. Beta', accessPermissions: ['cash', 'administration'] };
  prisma.tenant.findUnique.mockResolvedValue({ active: true, activeModules: ['veterinary', 'grooming', 'retail'] });
  prisma.staffCredential.findFirst.mockImplementation(async ({ where }) => where.staff.tenantId === 'clinic-a' && where.staffId === 'vet-a' && where.sessionVersion === 1
    ? { staffId: 'vet-a', staff } : null);
});
function dashboard() {
  const app = express(); app.use(express.json());
  app.use(resolveTenant, allowVeterinaryDashboard, (req, res) => res.json({ access: req.access, tenant: req.tenant, actor: req.actor }));
  return app;
}

test('veterinarian receives administrative access to the clinic and keeps professional identity', async () => {
  const app = dashboard();
  for (const path of ['/staff/vet-b/access', '/tenant/config', '/metrics/revenue', '/inventory/products', '/appointments']) {
    const response = await request(app).post(path).set(headers).send({});
    expect(response.status).toBe(200);
    expect(response.body.access).toMatchObject({ role: 'admin', professionalRole: 'vet', capabilities: { administration: true, finance: true, schedule: true } });
    expect(response.body.tenant).toEqual({ isSuperAdmin: false, tenantId: 'clinic-a', viewAllTenants: false });
    expect(response.body.actor).toMatchObject({ type: 'admin', professionalRole: 'vet', staffId: 'vet-a' });
  }
  expect(staff.role).toBe('vet');
  expect(compatibleRole(staff, 'grooming')).toBe(false);
  expect(compatibleRole(staff, 'veterinary')).toBe(true);
});

test('withdrawing administration immediately removes privileges without losing individually selected cash', async () => {
  const app = dashboard();
  expect((await request(app).post('/staff').set(headers).send({})).status).toBe(200);
  staff.accessPermissions = ['cash'];
  expect((await request(app).post('/staff').set(headers).send({ accessPermissions: ['administration'] })).status).toBe(403);
  expect((await request(app).patch('/staff/vet-a/access').set(headers).send({ accessPermissions: ['administration'] })).status).toBe(403);
  expect((await request(app).get('/metrics/revenue').set(headers)).status).toBe(403);
  expect((await request(app).get('/cash/operational').set(headers)).status).toBe(200);
  staff.accessPermissions = [];
  expect((await request(app).get('/cash/operational').set(headers)).status).toBe(403);
});

test('administration never bypasses tenant membership or a revoked credential', async () => {
  const app = dashboard();
  expect((await request(app).get('/staff').set({ ...headers, 'x-tenant-id': 'clinic-b' })).status).toBe(403);
  expect((await request(app).get('/staff').set({ ...headers, 'x-staff-session-version': '2' })).status).toBe(403);
  prisma.staffCredential.findFirst.mockResolvedValue(null);
  expect((await request(app).get('/access').set(headers)).status).toBe(403);
});

test('billing revalidation recognizes current administrative permissions, and their revocation', async () => {
  const app = express(); app.use(staffAuthRoutes);
  const allowed = await request(app).get('/staff-session').set(headers);
  expect(allowed.status).toBe(200); expect(allowed.body.role).toBe('admin');
  staff.accessPermissions = [];
  expect((await request(app).get('/staff-session').set(headers)).body.role).toBe('vet');
  expect((await request(app).get('/staff-session').set({ ...headers, 'x-tenant-id': 'clinic-b' })).status).toBe(403);
});

test('unknown profiles and permissions cannot become administrators; audit snapshots retain effective authority', () => {
  const access = effectiveAccess({ type: 'unknown', accessPermissions: ['administration'] }, ['veterinary']);
  expect(access.capabilities.administration).toBe(false);
  expect(access.navigation).toHaveLength(0);
  expect(effectiveAccess({ type: 'vet', accessPermissions: ['super_admin'] }, ['veterinary']).capabilities.administration).toBe(false);
  expect(actorSnapshot({ type: 'admin', professionalRole: 'vet', staffId: 'vet-a', name: 'Dra. Beta' }, 'recorded')).toMatchObject({ recordedActorId: 'staff:vet-a', recordedActorRole: 'admin' });
});
