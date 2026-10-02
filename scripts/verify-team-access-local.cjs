/* Disposable HTTP verification against Docker local only. Never runs on VPS. */
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'backend/node_modules/dotenv')).config({ path: path.join(root, 'backend/.env'), override: true, quiet: true });
const database = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) && database.pathname === '/mateos_dev', 'Local database required');
const prisma = require(path.join(root, 'backend/src/lib/prisma'));
const { hashPassword } = require(path.join(root, 'backend/src/services/staff-credential.service'));
const prefix = 'local-team-access-check-';
const tenantId = process.env.SINGLE_TENANT_ID;
assert(tenantId, 'Local tenant required');
const password = 'Local-role-check-2026!'; // Synthetic, disposable; never a real user credential.
const roles = ['admin', 'receptionist', 'vet', 'groomer'];
const header = role => ({ 'content-type': 'application/json', 'x-internal-token': process.env.INTERNAL_API_SECRET, 'x-tenant-id': tenantId, 'x-staff-id': prefix + role, 'x-staff-session-version': '1' });
async function call(role, url, method = 'GET', body) {
  const response = await fetch('http://localhost:3000/api/dashboard' + url, { method, headers: header(role), ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function cleanup() {
  const where = { tenantId, id: { startsWith: prefix } };
  await prisma.transactionItem.deleteMany({ where: { transaction: where } });
  await prisma.transaction.deleteMany({ where });
  await prisma.appointment.deleteMany({ where });
  await prisma.pet.deleteMany({ where });
  await prisma.user.deleteMany({ where });
  await prisma.staffCredential.deleteMany({ where: { staff: where } });
  await prisma.staff.deleteMany({ where });
  await prisma.service.deleteMany({ where });
}
async function run() {
  if (process.argv.includes('--cleanup')) { await cleanup(); console.log('Disposable local fixtures removed'); return; }
  assert.equal(await prisma.staff.count({ where: { id: { startsWith: prefix } } }), 0, 'Clean previous fixtures first');
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assert(tenant.activeModules.includes('grooming') && tenant.activeModules.includes('veterinary'), 'Local walkthrough requires current two service areas');
  const passwordHash = await hashPassword(password);
  for (const role of roles) await prisma.staff.create({ data: { id: prefix + role, tenantId, role, name: 'Prueba ' + role, generatesCommission: false,
    credential: { create: { email: `${prefix}${role}@example.invalid`, passwordHash } } } });
  const category = await prisma.serviceCategory.findFirstOrThrow({ where: { tenantId, name: 'grooming' } });
  await prisma.service.create({ data: { id: prefix + 'service', tenantId, categoryId: category.id, name: 'Prueba local de permisos', duration: 30, basePrice: 42000 } });
  await prisma.user.create({ data: { id: prefix + 'owner', tenantId, phone: 'test-role-phone', name: 'Cliente de prueba', notes: 'PRIVATE_CLIENT_NOTE' } });
  await prisma.pet.create({ data: { id: prefix + 'pet', tenantId, ownerId: prefix + 'owner', name: 'Mascota de prueba', type: 'dog', weight: 12, notes: 'PRIVATE_CLINICAL_NOTE', operationalAlerts: 'Manejo suave' } });
  await prisma.appointment.create({ data: { id: prefix + 'appointment', tenantId, userId: prefix + 'owner', petId: prefix + 'pet', petName: 'Mascota de prueba', petType: 'dog', serviceId: prefix + 'service', serviceType: 'grooming', date: new Date(), status: 'arrived' } });
  for (const role of roles) {
    const access = await call(role, '/access'); assert.equal(access.status, 200); assert.equal(access.body.role, role);
    assert.equal((await call(role, '/workspace')).status, 200);
    assert.equal((await call(role, '/cash/operational')).status, ['admin', 'receptionist'].includes(role) ? 200 : 403);
    assert.equal((await call(role, '/metrics/daily')).status, role === 'admin' ? 200 : 403);
    if (role !== 'admin') assert.equal((await call(role, '/tenant/config', 'PUT', { activeModules: ['retail'] })).status, 403);
  }
  const client = await call('receptionist', '/clients/' + prefix + 'owner');
  assert.equal(client.status, 200); assert(!JSON.stringify(client.body).includes('PRIVATE_')); assert.equal(client.body.pets[0].operationalAlerts, 'Manejo suave');
  assert.equal((await call('receptionist', '/pets/' + prefix + 'pet' + '/records')).status, 403);
  assert.equal((await call('groomer', '/appointments/' + prefix + 'appointment', 'PATCH', { status: 'in_progress' })).status, 200);
  const notes = await call('groomer', '/grooming/appointments/' + prefix + 'appointment' + '/notes', 'PUT', { notes: 'Baño con champú suave', expectedVersion: 1 });
  assert.equal(notes.status, 200); assert.equal(notes.body.finalPrice, null); assert.equal(notes.body.hasResolvedPrice, true);
  assert.equal((await call('vet', '/grooming/appointments/' + prefix + 'appointment' + '/notes', 'PUT', { notes: 'No autorizado', expectedVersion: 2 })).status, 403);
  const sale = await call('receptionist', '/transactions', 'POST', { userId: prefix + 'owner', petId: prefix + 'pet', paymentMethod: 'cash', items: [{ description: 'Prueba de cobro', itemKind: 'service', quantity: 1, unitPrice: 1000 }], recordedActorId: 'forged-admin' });
  assert.equal(sale.status, 201); assert.equal(sale.body.recordedBy.id, 'staff:' + prefix + 'receptionist');
  await prisma.transaction.update({ where: { id: sale.body.id }, data: { id: prefix + 'sale' } });
  assert.equal((await call('groomer', '/transactions', 'POST', { items: [{ description: 'Prueba', unitPrice: 1000 }] })).status, 403);
  await prisma.staff.update({ where: { id: prefix + 'groomer' }, data: { accessPermissions: ['cash', 'appointment_price'] } });
  assert.equal((await call('groomer', '/cash/operational')).status, 200);
  const priced = await call('groomer', '/appointments/' + prefix + 'appointment', 'PATCH', { finalPrice: 46000 });
  assert.equal(priced.status, 200); assert.equal((await prisma.appointment.findUnique({ where: { id: prefix + 'appointment' } })).priceActorId, 'staff:' + prefix + 'groomer');
  await prisma.staff.update({ where: { id: prefix + 'groomer' }, data: { accessPermissions: [] } });
  assert.equal((await call('groomer', '/cash/operational')).status, 403);
  await prisma.staffCredential.update({ where: { staffId: prefix + 'vet' }, data: { sessionVersion: 2 } });
  assert.equal((await call('vet', '/access')).status, 403);
  console.log('PASS: 4 live profiles; operational privacy; grooming assignment/notes; authenticated cash/price snapshots; live grants/revocation; expired session denied');
}
run().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => { if (!process.argv.includes('--keep')) await cleanup(); await prisma.$disconnect(); });
