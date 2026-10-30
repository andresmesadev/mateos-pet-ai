const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function verify({ prisma, base, browser, context, page, password, output, check, reviewFixture }) {
  reviewFixture.assertLocalUrl(base);
  const { registerTenantAdministrator } = require('../backend/src/services/onboarding-registration.service');
  const { provisionDefaultDigitalEmployees } = require('../backend/src/services/tenant-provisioning.service');
  const observations = [];
  async function layout(page, label, widths = [1440, 768, 390, 320]) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
      const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      assert(metrics.scroll <= metrics.width + 1, `${label}: horizontal overflow at ${width}: ${metrics.scroll}`);
      observations.push({ label, width, overflow: false });
      if ([1440, 390].includes(width)) await page.screenshot({ path: path.join(output, `${label}-${width}.png`), fullPage: true });
    }
  }
  async function login(page, email) {
    await page.goto(base + '/login');
    await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(base + '/dashboard', { timeout: 30000 });
    await page.getByText('Hola,', { exact: false }).first().waitFor().catch(() => {});
  }
  const businesses = [];
  for (const activity of ['veterinary', 'grooming', 'retail']) {
    const tenant = await registerTenantAdministrator({ name: `Demostración ${activity}`, slug: `qa-final-${activity}`,
      ownerName: 'Administrador de demostración', email: `qa-final-${activity}@example.invalid`, password, activeModules: [activity] });
    await provisionDefaultDigitalEmployees(tenant.id);
    const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await reviewFixture.guardBrowser(browserContext);
    const tab = await browserContext.newPage(); const errors = [];
    tab.on('pageerror', error => errors.push(error.message));
    await login(tab, `qa-final-${activity}@example.invalid`);
    const accessResponse = await browserContext.request.get(base + '/api/proxy/dashboard/access');
    assert.equal(accessResponse.status(), 200);
    const access = await accessResponse.json(); assert.deepEqual(access.activeModules, [activity]);
    await tab.goto(base + '/dashboard');
    await layout(tab, `home-${activity}`);
    await tab.setViewportSize({ width: 1440, height: 1000 });
    const menu = tab.locator('aside');
    if (activity === 'veterinary') assert(await menu.getByRole('link', { name: 'Consultas veterinarias', exact: true }).isVisible());
    else assert.equal(await menu.getByRole('link', { name: 'Consultas veterinarias', exact: true }).count(), 0);
    if (activity === 'grooming') assert(await menu.getByRole('link', { name: 'Peluquería', exact: true }).isVisible());
    else assert.equal(await menu.getByRole('link', { name: 'Peluquería', exact: true }).count(), 0);
    check(`${activity}: real login, only selected operational modules and responsive dashboard`);
    await tab.goto(base + '/dashboard/billing');
    await tab.getByRole('heading', { name: 'Plan y facturación', exact: true }).waitFor();
    const offer = await tab.locator('main').innerText();
    assert.match(offer, /Personalizado/); assert.match(offer, /Precios de referencia/);
    assert.doesNotMatch(offer, /50 citas|5 usuarios|Staff ilimitado|Múltiples sedes|API de integración|Más popular/i);
    assert.match(offer, /Sin suscripción/);
    assert.doesNotMatch(offer, /Inactivo/);
    await layout(tab, `billing-${activity}`);
    await tab.goto(base + '/dashboard/settings/integrations');
    await tab.getByRole('heading', { name: 'WhatsApp e inteligencia artificial', exact: true }).waitFor();
    await tab.getByText('Sin conexión comercial registrada', { exact: true }).waitFor();
    const state = await (await browserContext.request.get(base + '/api/proxy/integrations')).json();
    assert.equal(state.platformAdministrator, false); assert.equal(state.whatsapp.connection, null);
    assert.equal(state.ai.configured, false); assert.equal(state.ai.limit, 0);
    assert.equal(state.ai.enabled, false);
    assert.equal(await tab.getByLabel('Cupo asignado por la plataforma').count(), 0);
    await layout(tab, `integrations-${activity}`);
    assert.equal(errors.length, 0, errors.join('\n'));
    businesses.push({ tenant, browserContext, tab, errors });
    check(`${activity}: truthful plans, unconfigured channel and no inherited AI balance or quota editor`);
  }

  const [vet, groomer] = businesses;
  const originalSession = await (await context.request.get(base + '/api/auth/session')).json();
  const originalTenant = await prisma.tenant.findUnique({ where: { id: originalSession.user.tenantId } });
  process.env.WHATSAPP_REACTIVATION_TEMPLATES_JSON = JSON.stringify(Object.fromEntries([groomer.tenant, originalTenant].map(tenant => [tenant.id, {
    name: 'reactivacion_synthetic', languageCode: 'es', body: 'Hola {{1}}. Somos {{2}}. ¿Deseas agendar una visita?',
  }])));
  for (const business of [groomer, { tenant: originalTenant, browserContext: context, tab: page }]) {
    const response = await business.browserContext.request.get(base + '/api/proxy/dashboard/campaigns/reactivation/context');
    assert.equal(response.status(), 200);
    const preview = await response.json();
    assert.equal(preview.ready, false); assert.equal(preview.channelConfigured, false);
    assert(preview.preview.includes(business.tenant.name));
    await business.tab.goto(base + '/dashboard/reactivation');
    await business.tab.getByText('Ver texto de la plantilla', { exact: true }).click();
    assert((await business.tab.locator('main').innerText()).includes(`Somos ${business.tenant.name}.`));
    await layout(business.tab, business.tenant.id === groomer.tenant.id ? 'reactivation-grooming' : 'reactivation-second-business');
  }
  assert.equal(await prisma.user.count({ where: { lastReminderSentAt: { not: null } } }), 0);
  check('two businesses see their own template identity while paused WhatsApp prevents sends and contact metrics');
  const customer = await prisma.user.create({ data: { tenantId: vet.tenant.id, name: 'SOLO_NEGOCIO_VETERINARIA', phone: '000000012345' } });
  const foreignClients = await groomer.browserContext.request.get(base + `/api/proxy/dashboard/clients?tenant=${vet.tenant.id}&search=SOLO_NEGOCIO&limit=8`);
  assert.equal(foreignClients.status(), 200); assert(!JSON.stringify(await foreignClients.json()).includes(customer.name));
  const forbiddenLimit = await groomer.browserContext.request.post(base + '/api/proxy/integrations', {
    headers: { origin: base }, data: { action: 'limit', tenantId: vet.tenant.id, monthlyLimit: 99999 },
  });
  assert.equal(forbiddenLimit.status(), 403);
  check('a business cannot read another customer or assign its own AI balance');

  await vet.tab.goto(base + '/dashboard/billing'); await vet.tab.setViewportSize({ width: 1440, height: 1000 });
  const updates = vet.tab.getByRole('button', { name: 'Actualizar', exact: true });
  await updates.first().click();
  await vet.tab.waitForURL(url => url.searchParams.get('success') === '1');
  assert.equal(reviewFixture.stripeCalls.at(-1).priceId, 'price_reviewBasic');
  assert.equal(reviewFixture.stripeCalls.at(-1).tenantId, vet.tenant.id);
  assert.equal(await vet.tab.getByText('El proveedor confirmó una suscripción habilitada.', { exact: true }).count(), 0);
  assert.equal((await prisma.tenant.findUnique({ where: { id: vet.tenant.id } })).plan, 'free');
  check('checkout sends only the server-allowed Basic price and a return URL cannot confirm a subscription');

  await prisma.tenant.update({ where: { id: vet.tenant.id }, data: { active: false, plan: 'basic', stripeCustomerId: 'cus_synthetic', stripeSubscriptionId: 'sub_synthetic', subscriptionStatus: 'past_due' } });
  await vet.tab.goto(base + '/dashboard/billing');
  await vet.tab.locator('p[role="status"]:visible').filter({ hasText: 'El negocio está suspendido.' }).waitFor();
  assert.equal((await vet.browserContext.request.get(base + '/api/proxy/dashboard/clients')).status(), 402);
  assert.equal((await vet.browserContext.request.get(base + '/api/proxy/billing')).status(), 200);
  await layout(vet.tab, 'billing-suspended');
  const portalResponse = vet.tab.waitForResponse(response => new URL(response.url()).pathname === '/api/proxy/billing' && response.request().method() === 'POST');
  await vet.tab.getByRole('button', { name: 'Gestionar pagos y suscripción', exact: true }).click();
  assert.equal((await portalResponse).status(), 200);
  assert.equal(reviewFixture.stripeCalls.at(-1).action, 'portal');
  await prisma.staff.update({ where: { id: (await prisma.staff.findFirst({ where: { tenantId: vet.tenant.id } })).id }, data: { role: 'vet' } });
  assert.equal((await vet.browserContext.request.get(base + '/api/proxy/billing')).status(), 403);
  check('suspension blocks operations but keeps payment management; a live role change revokes billing authority');

  for (const kind of ['pending', 'unknown', 'login-failure']) {
    const partialContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await reviewFixture.guardBrowser(partialContext);
    const partial = await partialContext.newPage();
    const partialErrors = []; partial.on('pageerror', error => partialErrors.push(error.message));
    let registrations = 0;
    partial.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/onboarding/register') registrations++; });
    if (kind === 'unknown') await partial.route('**/api/onboarding/register', async route => {
      const response = await route.fetch(), data = await response.json(); delete data.provisioning;
      await route.fulfill({ response, json: data });
    });
    if (kind === 'login-failure') await partial.route('**/api/auth/callback/credentials**', route => route.fulfill({ status: 401, json: { url: base + '/login?error=CredentialsSignin' } }));
    await partial.goto(base + '/onboarding');
    await partial.getByLabel('Nombre del negocio', { exact: true }).fill('QA pending ' + kind);
    await partial.getByText('Disponible para tu negocio', { exact: true }).waitFor();
    await partial.getByRole('button', { name: 'Continuar', exact: true }).click();
    await partial.getByLabel('Tu nombre', { exact: true }).fill('Administrador de prueba');
    await partial.getByLabel('Correo electrónico', { exact: true }).fill(`qa-${kind}@example.invalid`);
    await partial.getByLabel('Contraseña', { exact: true }).fill(password);
    await partial.getByLabel('Confirma tu contraseña', { exact: true }).fill(password);
    await partial.getByRole('button', { name: 'Revisar mis datos', exact: true }).click();
    await partial.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
    await partial.getByRole('heading', { name: kind === 'unknown' ? 'No pudimos comprobar la preparación de tus asistentes' : 'La preparación de tus asistentes quedó pendiente', exact: true }).waitFor();
    if (kind === 'login-failure') await partial.getByRole('region', { name: 'Registro de cuenta' }).getByRole('alert').waitFor();
    else await partial.getByRole('link', { name: 'Entrar a mi negocio', exact: true }).waitFor();
    const support = await partial.getByRole('link', { name: 'Solicitar revisión por correo', exact: true }).getAttribute('href');
    assert(!decodeURIComponent(support).includes(password));
    await partial.locator('form').evaluate(form => form.requestSubmit()); assert.equal(registrations, 1);
    await layout(partial, `onboarding-${kind}`);
    await partial.getByRole('link', { name: 'Solicitar revisión por correo', exact: true }).focus();
    await partial.keyboard.press('Tab');
    assert(await partial.evaluate(() => document.activeElement?.getAttribute('href')?.startsWith('/')));
    assert.equal(partialErrors.length, 0, partialErrors.join('\n'));
    if (kind !== 'login-failure') {
      await partial.getByRole('link', { name: 'Entrar a mi negocio', exact: true }).click();
      await partial.waitForURL(base + '/dashboard');
      assert.equal((await partialContext.request.get(base + '/api/proxy/dashboard/access')).status(), 200);
    }
    await partialContext.close();
    check(`onboarding ${kind}: explicit preparation notice, recovery action, no duplicate registration and responsive layout`);
  }
  assert.equal(reviewFixture.blockedBrowserRequests.length, 0, 'Unexpected external browser requests');
  await context.request.get(base + '/api/auth/session'); // Original session is still usable.
  await page.goto(base + '/dashboard');
  fs.writeFileSync(path.join(output, 'review-observations.json'), JSON.stringify({ observations, providerCalls: reviewFixture.stripeCalls.map(call => ({ action: call.action, priceId: call.priceId })), realExternalCalls: 0 }, null, 2));
  for (const business of businesses) { assert.equal(business.errors.length, 0, business.errors.join('\n')); await business.browserContext.close(); }
  check('all review contexts closed; evidence contains synthetic layouts and mocked provider actions only');
};
