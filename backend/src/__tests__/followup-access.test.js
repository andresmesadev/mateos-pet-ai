jest.mock('../services/business-config.service', () => ({ getActiveModules: jest.fn() }));
const { getActiveModules } = require('../services/business-config.service');
const { allowVeterinaryDashboard } = require('../middleware/allowVeterinaryDashboard');
async function gate(actor, modules, method, path) {
  getActiveModules.mockResolvedValue(modules);
  const req = { actor, tenant: { tenantId: 'tenant-a' }, method, path };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }; const next = jest.fn();
  await allowVeterinaryDashboard(req, res, next);
  return { res, next };
}
test('grooming-only admin may resolve shared followups without gaining clinical record writes', async () => {
  const actor = { type: 'admin', email: 'admin@example.invalid' };
  expect((await gate(actor, ['grooming'], 'PATCH', '/next-actions/qa')).next).toHaveBeenCalled();
  expect((await gate(actor, ['grooming'], 'PUT', '/appointments/qa/medical-record')).res.status).toHaveBeenCalledWith(403);
  expect((await gate(actor, ['retail'], 'PATCH', '/next-actions/qa')).res.status).toHaveBeenCalledWith(403);
});
test.each(['vet', 'groomer', 'receptionist'])('campaigns and administrative followup list stay unavailable to %s', async role => {
  const actor = { type: role, staffId: 'qa', accessPermissions: ['cash'] };
  for (const [method, path] of [['GET', '/opportunities'], ['GET', '/campaigns/reactivation/context'], ['POST', '/campaigns/reactivation']]) {
    expect((await gate(actor, ['veterinary', 'grooming', 'retail'], method, path)).res.status).toHaveBeenCalledWith(403);
  }
});
