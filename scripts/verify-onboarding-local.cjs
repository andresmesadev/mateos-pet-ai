// Real registration + NextAuth + tenant isolation, disposable local PostgreSQL.
// Requires the existing pgvector image and Playwright (NODE_PATH may locate it).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const root = path.resolve(__dirname, '..');
const { Client, Pool } = require(path.join(root, 'backend/node_modules/pg'));
const { chromium } = require('playwright');
const marker = 'onboarding-check-' + randomBytes(6).toString('hex');
const password = 'Frase de prueba ' + randomBytes(12).toString('hex');
const secret = randomBytes(32).toString('hex');
const output = path.join(root, '.cache/onboarding-verification');
const image = 'pgvector/pgvector:0.8.6-pg18-bookworm';
let container, pool, prisma, backend, frontend, browser, base, apiBase, passed = 0;
let frontendLogs = '';
const check = message => { passed++; console.log('PASS ' + message); };

function docker(args, env) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, env: env || process.env, timeout: 30000 });
  if (result.status !== 0) throw new Error('Docker operation failed: ' + args[0]);
  return result.stdout.trim();
}

async function waitFor(test, label) {
  for (let i = 0; i < 90; i++) { try { if (await test()) return; } catch {} await delay(500); }
  throw new Error('Timed out: ' + label);
}

async function main() {
  try {
    container = docker(['run', '--pull', 'never', '--rm', '-d', '--name', marker,
      '--label', 'mateos.verification=' + marker, '-e', 'POSTGRES_PASSWORD', '-e', 'POSTGRES_DB=onboarding_test',
      '-p', '127.0.0.1::5432', '--tmpfs', '/var/lib/postgresql', image], { ...process.env, POSTGRES_PASSWORD: password });
    assert(/^[a-f0-9]{64}$/.test(container));
    const port = docker(['port', container, '5432/tcp']).split(':').at(-1);
    assert(/^\d+$/.test(port));
    const dbUrl = new URL('postgresql://postgres@127.0.0.1:' + port + '/onboarding_test'); dbUrl.password = password;
    await waitFor(async () => {
      const client = new Client({ connectionString: dbUrl.toString(), connectionTimeoutMillis: 500 });
      try { await client.connect(); await client.query('CREATE EXTENSION IF NOT EXISTS vector'); return true; } finally { await client.end(); }
    }, 'temporary PostgreSQL');
    const migrated = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: root, env: { ...process.env, DATABASE_URL: dbUrl.toString() }, encoding: 'utf8', timeout: 120000, windowsHide: true,
    });
    assert.equal(migrated.status, 0, 'Fresh temporary database migration failed');
    const drift = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code'], {
      cwd: root, env: { ...process.env, DATABASE_URL: dbUrl.toString() }, encoding: 'utf8', timeout: 120000, windowsHide: true,
    });
    assert.equal(drift.status, 0, 'Migrated database differs from Prisma schema');
    check('all migrations apply from empty PostgreSQL, including optional WhatsApp identity');
    process.env.DATABASE_URL = dbUrl.toString(); process.env.NODE_ENV = 'development';
    process.env.INTERNAL_API_SECRET = secret; process.env.SINGLE_TENANT_ID = 'legacy-clinic';
    process.env.OPENAI_API_KEY = 'test-key-no-provider-calls'; process.env.ADMIN_EMAIL = 'platform@example.test';
    const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'));
    const { PrismaPg } = require(path.join(root, 'backend/node_modules/@prisma/adapter-pg'));
    pool = new Pool({ connectionString: dbUrl.toString() });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: true }) });
    const prismaFile = require.resolve('../backend/src/lib/prisma');
    require.cache[prismaFile] = { id: prismaFile, filename: prismaFile, loaded: true, exports: prisma };
    await prisma.eventType.create({ data: { name: 'EmpleadoDigitalRegistrado', originContext: 'Empleados Digitales' } });
    await prisma.tenant.create({ data: { id: 'legacy-clinic', name: 'Negocio anterior de prueba', slug: 'legacy-clinic' } });
    const express = require(path.join(root, 'backend/node_modules/express'));
    const app = express(); app.use(express.json());
    app.use('/api/onboarding', (req, _res, next) => {
      assert(!req.headers['x-internal-token'], 'Public adapter forwarded internal authority'); next();
    }, require('../backend/src/routes/onboarding.routes'));
    app.use('/api/internal', require('../backend/src/middleware/requireInternalToken').requireInternalToken, require('../backend/src/routes/staff-auth.routes'));
    if (process.argv.includes('--team-permissions')) {
      // Exercise Next's real billing authorization without calling Stripe.
      app.get('/api/billing/status/:id', require('../backend/src/middleware/requireInternalToken').requireInternalToken, (req, res) => res.json({ tenantId: req.params.id }));
    }
    app.use('/api/dashboard', require('../backend/src/middleware/resolveTenant').resolveTenant, require('../backend/src/routes/dashboard.routes'));
    backend = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
    apiBase = 'http://127.0.0.1:' + backend.address().port;
    // Reserve a free local port without disturbing the developer's application.
    const reservation = await new Promise(resolve => { const server = require('node:net').createServer().listen(0, '127.0.0.1', () => resolve(server)); });
    const frontPort = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
    base = 'http://127.0.0.1:' + frontPort;
    frontend = spawn(process.execPath, [path.join(root, 'frontend/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(frontPort)], {
      cwd: path.join(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production', NEXT_VERIFY_BUILD: '1', API_URL: apiBase, NEXTAUTH_URL: base,
        NEXTAUTH_SECRET: secret, AUTH_URL: base, AUTH_SECRET: secret, INTERNAL_API_SECRET: secret, ADMIN_EMAIL: 'platform@example.test', ADMIN_PASSWORD: password },
    });
    frontend.stdout.on('data', b => { frontendLogs = (frontendLogs + b).slice(-20000); });
    frontend.stderr.on('data', b => { frontendLogs = (frontendLogs + b).slice(-20000); });
    await waitFor(async () => frontend.exitCode === null && (await fetch(base + '/onboarding')).ok, 'Next.js production preview');
    fs.mkdirSync(output, { recursive: true });
    browser = await chromium.launch({ headless: true, channel: process.env.MATEOS_BROWSER_CHANNEL || 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base); await page.getByRole('banner').getByRole('link', { name: 'Crear mi cuenta', exact: true }).click();
    let oldRequested;
    const startedOld = new Promise(resolve => { oldRequested = resolve; });
    await page.route('**/api/onboarding/verify/old-clinic', async route => {
      oldRequested(); await delay(1500);
      await route.fulfill({ json: { available: false } }).catch(() => {});
    });
    await page.route('**/api/onboarding/verify/current-clinic', async route => {
      await delay(2300); await route.fulfill({ json: { available: true } });
    });
    await page.getByLabel('Nombre del negocio', { exact: true }).fill('Old clinic'); await startedOld;
    await page.getByLabel('Nombre del negocio', { exact: true }).fill('Current clinic');
    assert.equal(await page.getByRole('button', { name: 'Continuar', exact: true }).isDisabled(), true);
    await page.getByText('Disponible para tu negocio', { exact: true }).waitFor();
    assert.equal(await page.getByText('Ese identificador ya está en uso.', { exact: false }).count(), 0);
    check('changing the business cancels stale availability responses and keeps Continue locked until the current result');
    await page.getByLabel('Nombre del negocio', { exact: true }).fill('Clínica de prueba');
    await page.getByText('Disponible para tu negocio', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, '01-negocio-desktop.png'), fullPage: true });
    await page.getByLabel('Peluquería', { exact: true }).check();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByLabel('Tu nombre', { exact: true }).fill('Administradora de prueba');
    await page.getByLabel('Correo electrónico', { exact: true }).fill('owner@example.test');
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByLabel('Confirma tu contraseña', { exact: true }).fill(password + '-different');
    await page.getByRole('button', { name: 'Revisar mis datos', exact: true }).click();
    await page.getByRole('region', { name: 'Registro de cuenta' }).getByRole('alert').waitFor(); assert.equal(await prisma.tenant.count(), 1);
    check('password mismatch blocks creation before any write');
    await page.getByLabel('Confirma tu contraseña', { exact: true }).fill(password);
    await page.screenshot({ path: path.join(output, '02-acceso-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Revisar mis datos', exact: true }).click();
    await page.getByRole('button', { name: 'Atrás', exact: true }).click();
    assert.equal(await page.getByLabel('Correo electrónico', { exact: true }).inputValue(), 'owner@example.test');
    await page.getByRole('button', { name: 'Revisar mis datos', exact: true }).click();
    await page.screenshot({ path: path.join(output, '03-revision-desktop.png'), fullPage: true });
    const registrationResponse = page.waitForResponse(response => response.url() === base + '/api/onboarding/register');
    await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
    const created = await registrationResponse;
    assert.equal(created.status(), 201, await created.text());
    try { await page.waitForURL(base + '/onboarding/success', { timeout: 30000 }); }
    catch {
      await page.screenshot({ path: path.join(output, 'failure-registration.png'), fullPage: true });
      const alert = await page.getByRole('region', { name: 'Registro de cuenta' }).getByRole('alert').textContent().catch(() => 'No UI error');
      throw new Error('Account committed but sign-in failed: ' + alert + '\n' + frontendLogs.replaceAll(secret, '[test secret]').replaceAll(password, '[test password]'));
    }
    const session = await (await context.request.get(base + '/api/auth/session')).json();
    assert.equal(session.user.role, 'admin'); assert.equal(session.user.isSuperAdmin, false); assert(session.user.staffId);
    assert.notEqual(session.user.tenantId, 'legacy-clinic');
    const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId }, include: { staff: { include: { credential: true } } } });
    assert.equal(tenant.phone, null); assert.equal(tenant.plan, 'free'); assert.deepEqual(tenant.activeModules, ['veterinary', 'grooming']);
    assert.equal(tenant.staff.length, 1); assert.equal(tenant.staff[0].generatesCommission, false);
    assert.notEqual(tenant.staff[0].credential.passwordHash, password);
    check('real browser creates tenant + hashed administrator and signs in through NextAuth, without WhatsApp or payment');
    await page.getByRole('link', { name: 'Entrar a mi negocio' }).click();
    await page.waitForURL(base + '/dashboard', { timeout: 30000 });
    const access = await context.request.get(base + '/api/proxy/dashboard/access'); assert.equal(access.status(), 200);
    assert.equal((await access.json()).role, 'admin');
    const members = await context.request.get(base + '/api/proxy/dashboard/staff?tenant=legacy-clinic');
    assert.equal(members.status(), 200);
    const staffPayload = await members.json();
    assert(!JSON.stringify(staffPayload).includes('legacy-clinic')); assert(!JSON.stringify(staffPayload).includes('passwordHash'));
    const forged = await fetch(apiBase + '/api/dashboard/access', { headers: { 'x-internal-token': secret, 'x-tenant-id': 'legacy-clinic', 'x-staff-id': session.user.staffId, 'x-staff-session-version': '1' } });
    assert.equal(forged.status, 403);
    check('first dashboard entry works with SINGLE_TENANT_ID present; forged or selected foreign tenant grants no access');
    const { registerTenantAdministrator } = require('../backend/src/services/onboarding-registration.service');
    const registration = { name: 'Otra clínica', slug: 'another-clinic', email: 'another@example.test', ownerName: 'Otra administradora', password, activeModules: ['retail'] };
    await registerTenantAdministrator(registration);
    const before = await prisma.tenant.count();
    await assert.rejects(registerTenantAdministrator({ ...registration, slug: 'must-rollback' }), error => error.code === 'P2002');
    assert.equal(await prisma.tenant.count(), before);
    const race = await Promise.allSettled(['concurrent-a', 'concurrent-b'].map(slug => registerTenantAdministrator({ ...registration, slug, email: 'race@example.test' })));
    assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await prisma.tenant.count(), before + 1);
    check('multiple tenants have no channel; duplicate and concurrent email writes roll back the entire losing tenant');
    const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobile = await anonymous.newPage(); await mobile.goto(base + '/onboarding');
    for (const width of [320, 390, 768]) {
      await mobile.setViewportSize({ width, height: 844 });
      assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow at ' + width);
    }
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.screenshot({ path: path.join(output, '04-negocio-mobile.png'), fullPage: true });
    const unauthed = await anonymous.request.get(base + '/api/proxy/dashboard/access'); assert.equal(unauthed.status(), 401);
    await mobile.goto(base + '/onboarding/success'); assert(new URL(mobile.url()).pathname === '/login');
    const reserved = await anonymous.request.post(base + '/api/onboarding/register', { data: { ...registration, email: 'PLATFORM@example.test' } }); assert.equal(reserved.status(), 409);
    const origin = await anonymous.request.post(base + '/api/onboarding/register', { headers: { origin: 'https://foreign.invalid' }, data: registration }); assert.equal(origin.status(), 403);
    check('mobile 320/390/768 have no horizontal overflow; anonymous access, reserved email and foreign origin are rejected');
    await mobile.goto(base + '/onboarding');
    await mobile.getByLabel('Nombre del negocio', { exact: true }).fill('Clínica de prueba');
    await mobile.getByText('Ese identificador ya está en uso.', { exact: false }).waitFor();
    assert.equal(await mobile.getByRole('button', { name: 'Continuar', exact: true }).isDisabled(), true);
    await mobile.getByText('Personalizar el identificador del negocio', { exact: true }).click();
    await mobile.getByLabel('Identificador del negocio', { exact: true }).fill('mobile-clinic');
    await mobile.getByText('Disponible para tu negocio', { exact: true }).waitFor();
    await mobile.getByRole('button', { name: 'Continuar', exact: true }).click();
    await mobile.getByLabel('Tu nombre', { exact: true }).fill('Cuenta móvil');
    await mobile.getByLabel('Correo electrónico', { exact: true }).fill('mobile@example.test');
    await mobile.getByLabel('Contraseña', { exact: true }).fill(password);
    await mobile.getByLabel('Confirma tu contraseña', { exact: true }).fill(password);
    await mobile.screenshot({ path: path.join(output, '05-acceso-mobile.png'), fullPage: true });
    await mobile.getByRole('button', { name: 'Revisar mis datos', exact: true }).click();
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mobile.screenshot({ path: path.join(output, '06-revision-mobile.png'), fullPage: true });
    let interceptedSignIn = false;
    await mobile.route('**/api/auth/callback/credentials**', route => {
      interceptedSignIn = true;
      return route.fulfill({ status: 401, json: { url: base + '/login?error=CredentialsSignin' } });
    });
    const countBeforeFallback = await prisma.tenant.count();
    await mobile.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
    await mobile.getByRole('heading', { name: 'Tu cuenta ya está creada', exact: true }).waitFor();
    try { await mobile.getByRole('region', { name: 'Registro de cuenta' }).getByRole('alert').waitFor({ timeout: 10000 }); }
    catch {
      await mobile.screenshot({ path: path.join(output, 'failure-recovery.png'), fullPage: true });
      throw new Error('Recovery state missing; URL=' + mobile.url() + ', sign-in intercepted=' + interceptedSignIn);
    }
    await mobile.locator('form').evaluate(form => form.requestSubmit());
    assert.equal(await prisma.tenant.count(), countBeforeFallback + 1);
    assert.equal(await mobile.getByRole('button', { name: 'Crear mi cuenta', exact: true }).count(), 0);
    assert.equal(interceptedSignIn, true);
    await mobile.unroute('**/api/auth/callback/credentials**');
    await mobile.getByRole('link', { name: 'Iniciar sesión', exact: true }).click();
    await mobile.getByLabel('Correo electrónico', { exact: true }).fill('mobile@example.test');
    await mobile.getByLabel('Contraseña', { exact: true }).fill(password);
    await mobile.getByRole('button', { name: 'Entrar', exact: true }).click();
    await mobile.waitForURL(base + '/dashboard', { timeout: 30000 });
    check('mobile customizes an occupied identifier; a failed auto-login preserves the account, prevents a second registration and recovers through real sign-in');
    if (process.argv.includes('--team-permissions')) {
      await require('./verify-team-permissions-scenario.cjs')({ prisma, base, browser, context, page, password, output, check });
    }
    if (process.argv.includes('--grooming-transport')) {
      await require('./verify-grooming-transport-scenario.cjs')({ prisma, base, browser, context, page, output, check, tenantId: session.user.tenantId });
    }
    if (process.argv.includes('--inventory-registration')) {
      await require('./verify-inventory-registration-browser.cjs')({ prisma, base, page, output, check, tenantId: session.user.tenantId });
    }
    if (process.argv.includes('--client-pet-names')) {
      await require('./verify-client-pet-names-scenario.cjs')({ prisma, base, context, page, output, check, tenantId: session.user.tenantId });
    }
    if (process.argv.includes('--new-owner-prices')) {
      await require('./verify-new-owner-prices-scenario.cjs')({ prisma, base, context, page, output, check, tenantId: session.user.tenantId });
    }
    await prisma.staffCredential.update({ where: { staffId: session.user.staffId }, data: { active: false } });
    assert.equal((await context.request.get(base + '/api/proxy/dashboard/access')).status(), 403);
    check('revoking the new administrator immediately blocks its existing session');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`Onboarding integration: ${passed} passed, 0 failed. Local disposable data only; no jobs, external messages or real charges.`);
    console.log('Screenshots: .cache/onboarding-verification/');
  } finally {
    await browser?.close();
    if (frontend && frontend.exitCode === null) { frontend.kill(); await Promise.race([new Promise(resolve => frontend.once('exit', resolve)), delay(4000)]); }
    if (backend) await new Promise(resolve => backend.close(resolve));
    await prisma?.$disconnect(); if (pool && !pool.ending) await pool.end();
    if (container) {
      assert.equal(docker(['inspect', '--format', '{{ index .Config.Labels "mateos.verification" }}', container]), marker);
      docker(['stop', '--time', '1', container]); console.log('PASS own temporary PostgreSQL container removed');
    }
  }
}

main().catch(error => { console.error(error.message.replaceAll(password, '[test password]')); process.exitCode = 1; });
