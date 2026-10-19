// Run with: node scripts/verify-onboarding-local.cjs --team-permissions
// Reuses that runner's temporary database, servers and real NextAuth session.
const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function ({ prisma, base, browser, context, page, password, output, check }) {
  const endpoint = '/api/proxy/dashboard/staff';
  await prisma.eventType.upsert({ where: { name: 'StaffRegistrado' }, create: { name: 'StaffRegistrado', originContext: 'Staff' }, update: {} });
  await page.goto(base + '/dashboard/settings?tab=usuarios');
  await page.getByRole('button', { name: 'Nuevo integrante', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre del integrante', { exact: true }).fill('Dra. Beta con administración');
  await dialog.getByRole('combobox').selectOption('vet');
  await dialog.getByRole('checkbox', { name: 'Caja operativa', exact: false }).check();
  await dialog.getByRole('button', { name: 'Acceso completo al dashboard', exact: true }).click();
  assert.equal(await dialog.getByRole('button', { name: 'Acceso completo al dashboard', exact: true }).getAttribute('aria-pressed'), 'true');
  await dialog.getByRole('button', { name: 'Permisos del perfil', exact: true }).click();
  assert.equal(await dialog.getByRole('checkbox', { name: 'Caja operativa', exact: false }).isChecked(), true);
  assert.equal(await dialog.getByRole('checkbox', { name: 'Ajustar precio de una cita', exact: false }).isChecked(), false);
  await dialog.getByRole('button', { name: 'Acceso completo al dashboard', exact: true }).click();
  await page.screenshot({ path: path.join(output, '07-team-permissions-desktop.png'), fullPage: true });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Team dialog overflow: ' + width);
    const submit = dialog.getByRole('button', { name: 'Crear integrante', exact: true });
    await submit.scrollIntoViewIfNeeded(); assert.equal(await submit.isVisible(), true);
  }
  await page.screenshot({ path: path.join(output, '08-team-permissions-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const createdResponse = page.waitForResponse(r => r.url().endsWith(endpoint) && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Crear integrante', exact: true }).click();
  const response = await createdResponse; assert.equal(response.status(), 201);
  const created = await response.json(); await dialog.waitFor({ state: 'hidden' });
  let staff = await prisma.staff.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(staff.role, 'vet'); assert.equal(staff.generatesCommission, true);
  assert.deepEqual(staff.accessPermissions, ['cash', 'administration']);
  assert.equal(await prisma.staffCredential.count({ where: { staffId: staff.id } }), 0);
  assert.equal(await prisma.domainEvent.count({ where: { tenantId: staff.tenantId, eventType: { name: 'StaffRegistrado' } } }), 1);
  check('real New member UI saves vet profile and chosen permissions together; full-access toggle preserves individual selections; mobile 320/390/768 fits');

  const count = await prisma.staff.count();
  const invalid = await context.request.post(base + endpoint, { data: { name: 'Should not persist', role: 'vet', accessPermissions: ['super_admin'] } });
  assert.equal(invalid.status(), 400); assert.equal(await prisma.staff.count(), count);
  const loginEmail = 'beta-vet@example.test';
  const credential = await context.request.put(base + endpoint + '/' + staff.id + '/credential', { data: { email: loginEmail, password } });
  assert.equal(credential.status(), 200);
  const professional = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const vetPage = await professional.newPage();
    await vetPage.goto(base + '/login');
    await vetPage.getByLabel('Correo electrónico', { exact: true }).fill(loginEmail);
    await vetPage.getByLabel('Contraseña', { exact: true }).fill(password);
    await vetPage.getByRole('button', { name: 'Entrar', exact: true }).click();
    await vetPage.waitForURL(base + '/dashboard');
    const session = await (await professional.request.get(base + '/api/auth/session')).json();
    assert.equal(session.user.role, 'vet'); assert.equal(session.user.isSuperAdmin, false);
    let access = await (await professional.request.get(base + '/api/proxy/dashboard/access')).json();
    assert.equal(access.professionalRole, 'vet'); assert.equal(access.role, 'admin'); assert.equal(access.capabilities.finance, true);
    await vetPage.getByText('Inicio · Veterinario/a', { exact: true }).waitFor();
    await vetPage.goto(base + '/dashboard/settings?tab=usuarios');
    await vetPage.getByRole('button', { name: 'Nuevo integrante', exact: true }).waitFor();
    await vetPage.screenshot({ path: path.join(output, '09-veterinarian-admin-access.png'), fullPage: true });
    const billing = await professional.request.get(base + '/api/proxy/billing');
    assert.equal(billing.status(), 200); assert.equal((await billing.json()).tenantId, staff.tenantId);
    assert.equal((await professional.request.get(base + '/api/proxy/dashboard/tenants/overview')).status(), 403);
    const roster = await (await professional.request.get(base + endpoint + '?tenant=legacy-clinic')).json();
    assert(Array.isArray(roster) && roster.every(row => row.tenantId === staff.tenantId));
    check('real veterinarian login retains title and reaches administrative dashboard and billing; no platform or foreign-clinic access');

    const memberRow = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: staff.name, exact: true }) });
    await memberRow.getByRole('button', { name: 'Perfil y permisos', exact: true }).click();
    await dialog.getByRole('button', { name: 'Permisos del perfil', exact: true }).click();
    await dialog.getByRole('button', { name: 'Guardar permisos', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    access = await (await professional.request.get(base + '/api/proxy/dashboard/access')).json();
    assert.equal(access.role, 'vet'); assert.equal(access.capabilities.administration, false); assert.equal(access.capabilities.cash, true);
    assert.equal((await professional.request.get(base + '/api/proxy/billing')).status(), 403);
    assert.equal((await professional.request.post(base + endpoint, { data: { name: 'Escalation attempt', role: 'admin', accessPermissions: ['administration'] } })).status(), 403);
    await vetPage.goto(base + '/dashboard/settings?tab=usuarios');
    await vetPage.waitForURL(base + '/dashboard');
    staff = await prisma.staff.findUniqueOrThrow({ where: { id: staff.id } });
    assert.equal(staff.role, 'vet'); assert.deepEqual(staff.accessPermissions, ['cash']);
    check('real permission editor revokes administration in the same session, keeps cash and profession, blocks billing/settings and self-escalation');
    await prisma.staffCredential.update({ where: { staffId: staff.id }, data: { active: false } });
    assert.equal((await professional.request.get(base + '/api/proxy/dashboard/access')).status(), 403);
  } finally { await professional.close(); }
};
