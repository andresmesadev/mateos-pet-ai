// Isolated browser scenarios. Fake backend + separate production frontend;
// no database connection, business writes, or changes to running dev servers.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');
const { effectiveAccess } = require('../backend/src/services/dashboard-access.service');
const backendPort = 3030, frontendPort = 3031, origin = `http://localhost:${frontendPort}`;
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const directory = path.join(__dirname, '../.cache/home-verification');
fs.mkdirSync(directory, { recursive: true });
let mode = { modules: ['veterinary', 'grooming', 'retail'], fail: false, empty: false, partial: false };
let calls = [];
const appointment = (id, category, status, record = false) => ({ id, date: `${today}T10:00:00-05:00`, status, serviceType: category === 'grooming' ? 'bath' : 'vet', serviceCategory: category, serviceName: category === 'grooming' ? 'Baño básico' : 'Consulta veterinaria', petName: `Mascota ${id}`, petType: 'dog', clientName: 'Propietario de prueba', clientPhone: '0000000000', petId: 'pet-' + id, staffId: category === 'grooming' ? 'groomer' : 'vet', staffName: 'Profesional de prueba', finalPrice: 66000, priceResolution: null, startedAt: null, endedAt: null, hasMedicalRecord: record, groomingDeliveredAt: null, groomingNotes: '', groomingNotesVersion: 0 });
const backend = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const role = req.headers['x-staff-id'] || 'admin';
  const tenant = req.headers['x-tenant-id'] || 'fixture-tenant';
  const access = effectiveAccess({ type: role, staffId: role === 'admin' ? null : role }, mode.modules);
  const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (url.pathname === '/api/internal/staff-login') {
    let body = ''; for await (const chunk of req) body += chunk;
    const { email, password } = JSON.parse(body), requestedRole = email.split('@')[0];
    if (!['vet', 'groomer', 'receptionist'].includes(requestedRole) || password !== 'fixture-only-password') return send({}, 401);
    return send({ staffId: requestedRole, tenantId: 'fixture-tenant', name: requestedRole, email, role: requestedRole, sessionVersion: 1 });
  }
  if (req.method !== 'GET') return send({ error: 'Fixture is read-only' }, 405);
  calls.push({ path: url.pathname.replace('/api/dashboard', ''), tenant, role, status: url.searchParams.get('status') });
  if (url.pathname.endsWith('/access')) return send(access);
  if (url.pathname.endsWith('/tenant/profile')) return send({ id: tenant, name: 'Centro de prueba', activeModules: mode.modules });
  if (mode.fail && /\/inventory\/products|\/cash\/operational|\/metrics\/cashbox/.test(url.pathname)) return send({ error: 'Simulated read failure' }, 503);
  let rows = mode.empty ? [] : [appointment('historia', 'veterinary', 'completed'), appointment('entrega', 'grooming', 'completed'), ...Array.from({ length: 8 }, (_, i) => appointment('espera-' + i, 'veterinary', 'arrived'))];
  rows = rows.filter(row => mode.modules.includes(row.serviceCategory) && (role === 'admin' || role === 'receptionist' || row.serviceCategory === (role === 'vet' ? 'veterinary' : 'grooming')));
  if (url.pathname.endsWith('/appointments/today')) return send(rows);
  if (url.pathname.endsWith('/appointments/week')) return send({ appointments: rows });
  if (url.pathname.endsWith('/grooming/appointments')) return send({ appointments: rows.filter(row => row.serviceCategory === 'grooming'), hasMore: mode.partial });
  if (url.pathname.endsWith('/conversations')) return send({ data: mode.empty ? [] : [{ id: 'chat', name: 'Cliente de prueba', requires_human_attention: true, updatedAt: new Date().toISOString() }], pagination: { page: 1, limit: 2, total: mode.empty ? 0 : 1, totalPages: 1 } });
  if (url.pathname.endsWith('/cash/operational')) return send({ toReview: mode.empty ? [] : ['charge'], transactions: [], date: today, hasMore: mode.partial, totalRegistered: 0 });
  if (url.pathname.endsWith('/inventory/products')) return send({ data: mode.empty ? [] : [{ id: 'product', name: 'Producto de prueba', available: '0', physical: '0', expired: '0', uses: ['retail'], active: true, stockMinimum: 1, lowStock: true, lots: [] }], nextCursor: mode.partial ? 'cursor' : null });
  if (url.pathname.endsWith('/next-actions/upcoming')) return send(mode.empty ? [] : [{ id: 'follow', petId: 'pet-follow', petName: 'Control pendiente', type: mode.modules.includes('veterinary') ? 'control' : 'grooming', dueAt: `${today}T05:00:00Z` }]);
  if (url.pathname.endsWith('/metrics/cashbox')) return send({ transactions: mode.empty ? [] : [{ total: 66000.3 }], expenses: mode.empty ? [] : [{ amount: 10000.05 }] });
  return send([]);
});

(async () => {
  await new Promise((resolve, reject) => { backend.once('error', reject); backend.listen(backendPort, '127.0.0.1', resolve); });
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(frontendPort)], {
    cwd: path.join(__dirname, '../frontend'), env: { ...process.env, NEXT_VERIFY_BUILD: '1', API_URL: `http://127.0.0.1:${backendPort}`, NEXTAUTH_URL: origin, NEXTAUTH_SECRET: 'fixture-only-home-secret', AUTH_TRUST_HOST: 'true', INTERNAL_API_SECRET: 'fixture-only-home-token', ADMIN_EMAIL: 'admin@fixture.invalid', ADMIN_PASSWORD: 'fixture-only-password' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostics = ''; server.stdout.on('data', d => diagnostics = (diagnostics + d).slice(-1500)); server.stderr.on('data', d => diagnostics = (diagnostics + d).slice(-1500));
  let browser;
  try {
    for (let i = 0; i < 60; i++) { try { const r = await fetch(origin + '/login'); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    async function scenario(role, modules, options = {}) {
      mode = { modules, empty: false, fail: false, partial: false, ...options }; calls = [];
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      try {
        const request = context.request;
        const { csrfToken } = await (await request.get(origin + '/api/auth/csrf')).json();
        await request.post(origin + '/api/auth/callback/credentials', { maxRedirects: 0, form: { csrfToken, email: role + '@fixture.invalid', password: 'fixture-only-password', callbackUrl: origin + '/dashboard', json: 'true' } });
        assert.equal((await (await request.get(origin + '/api/auth/session')).json()).user?.role, role);
        calls = [];
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(origin + '/dashboard?tenant=fixture-selected', { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'Necesita atención', exact: true }).waitFor();
        const access = effectiveAccess({ type: role, staffId: role }, modules), c = access.capabilities;
        assert.equal(await page.getByRole('heading', { name: 'Resultados del negocio · hoy' }).count(), c.finance ? 1 : 0, 'Financial visibility: ' + role);
        assert.equal(await page.getByRole('heading', { name: 'Agenda de hoy', exact: true }).count(), c.agenda ? 1 : 0, 'Agenda visibility: ' + role);
        assert.equal(await page.getByRole('link', { name: /Nueva cita.*Agendar manualmente/ }).count(), c.schedule ? 1 : 0, 'Scheduling visibility: ' + role);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(errors.length, 0, errors.join('\n'));
        assert.equal(await page.locator('main time[datetime]').filter({ hasText: 'Consultado a las' }).count(), 1, 'Consulta fechada junto a la actualización');
        assert.equal(await page.getByText(/^Actualización parcial · algunas lecturas no están disponibles\.$/).count(), options.fail ? 1 : 0);
        if (options.fail) {
          assert(await page.getByText('No disponible. Actualiza Inicio para comprobar este pendiente.', { exact: true }).count() > 0);
          assert.equal(await page.getByRole('heading', { name: 'Sin pendientes en esta consulta' }).count(), 0);
          assert.equal(await page.getByText('Resultados no disponibles. Actualiza Inicio para comprobarlos.', { exact: true }).count(), 1);
        } else if (options.empty) {
          assert.equal(await page.getByRole('heading', { name: 'Sin pendientes en esta consulta' }).count(), 1);
        } else {
          assert.equal(await page.getByRole('link', { name: /Historias clínicas de hoy/, includeHidden: true }).count(), c.clinical ? 1 : 0);
          assert.equal(await page.getByRole('link', { name: /Entregas de peluquería/, includeHidden: true }).count(), c.grooming ? 1 : 0);
          assert.equal(await page.getByRole('link', { name: /Confirmar métodos de pago/, includeHidden: true }).count(), c.cash ? 1 : 0);
          if (c.agenda && modules.includes('veterinary') && role !== 'groomer') assert.equal(await page.getByRole('button', { name: /Abrir cita de/ }).count(), 8);
          if (options.partial) assert(await page.getByText('1 en lista', { exact: true }).count() > 0);
          const expectedFirst = { admin: 'Unidades vencidas', receptionist: 'WhatsApp necesita al equipo', vet: 'Historias clínicas de hoy', groomer: 'Entregas de peluquería' }[role];
          assert.equal(await page.locator('article[data-home-task]').first().getAttribute('data-home-task'), expectedFirst, 'Orden de pendientes del perfil');
        }
        const tasks=page.locator('article[data-home-task]');
        const warningCount=await page.locator('article[data-home-task][data-unavailable="true"]').count();
        if(warningCount) await page.getByText(new RegExp('^'+warningCount+' revisi[oó]n(?:es)? no disponible')).waitFor();
        assert(await page.locator('article[data-home-task]:visible').count()<=3,'Móvil muestra una página corta');
        const seen=new Set();
        const remember=async()=>{for(const id of await page.locator('article[data-home-task]:visible').evaluateAll(nodes=>nodes.map(node=>node.dataset.homeTask)))seen.add(id)};
        await remember();
        const pager=page.getByRole('navigation',{name:'Páginas de prioridades'});
        if(await pager.count()) {
          const numbers=pager.getByRole('button',{name:/^Página [0-9]+ de prioridades$/});
          for(let i=1;i<await numbers.count();i++){await numbers.nth(i).focus();await page.keyboard.press('Enter');await remember();}
          await numbers.first().click();
        }
        assert.equal(seen.size,await tasks.count(),'Todas las prioridades y errores son accesibles por páginas');
        if (role === 'admin' && modules.length === 3 && !options.fail && !options.empty && !options.partial) {
          const stamp = page.locator('main time[datetime]').filter({ hasText: 'Consultado a las' });
          const previous = await stamp.getAttribute('datetime');
          await page.getByRole('button', { name: 'Actualizar Inicio', exact: true }).first().click();
          await page.waitForFunction(before => [...document.querySelectorAll('main time[datetime]')].some(node => node.textContent.includes('Consultado a las') && node.getAttribute('datetime') > before), previous);
          console.log('PASS refresh: consultation timestamp advances after server reads');
        }
        assert.equal(errors.length, 0, errors.join('\n'));
        const links = await page.locator('main a[href^="/dashboard"]').evaluateAll(nodes => nodes.map(a => a.getAttribute('href')));
        assert(links.every(href => new URL(href, 'http://test').searchParams.get('tenant') === 'fixture-selected'), 'Every home destination preserves selected tenant');
        if (!c.clinical) assert(!calls.some(x => x.path === '/appointments/week'));
        if (!c.grooming) assert(!calls.some(x => x.path === '/grooming/appointments'));
        if (!c.cash) assert(!calls.some(x => x.path === '/cash/operational'));
        if (!c.finance) assert(!calls.some(x => x.path === '/metrics/cashbox'));
        const badScope = calls.filter(x => x.tenant !== (role === 'admin' ? 'fixture-selected' : 'fixture-tenant'));
        assert.equal(badScope.length, 0, 'Tenant remains derived from authenticated identity: ' + JSON.stringify(badScope));
        await page.screenshot({ path: path.join(directory, `fixture-${role}-${modules.join('-')}${options.fail ? '-failure' : options.empty ? '-empty' : options.partial ? '-partial' : ''}.png`), fullPage: true });
        console.log(`PASS fixture ${role}/${modules.join('+')}: role visibility, tenant isolation, source gates, mobile layout${options.fail ? ', partial failure' : options.empty ? ', empty state' : options.partial ? ', partial lists' : ''}`);
      } finally { await context.close(); }
    }
    for (const role of ['admin', 'receptionist', 'vet', 'groomer']) await scenario(role, ['veterinary', 'grooming', 'retail']);
    for (const modules of [['retail'], ['veterinary'], ['grooming'], ['veterinary', 'retail'], ['grooming', 'retail'], ['veterinary', 'grooming']]) await scenario('admin', modules);
    await scenario('admin', ['veterinary', 'grooming', 'retail'], { empty: true });
    await scenario('admin', ['veterinary', 'grooming', 'retail'], { fail: true });
    await scenario('admin', ['veterinary', 'grooming', 'retail'], { partial: true });
  } catch (error) { throw new Error(error.stack + '\n' + diagnostics); }
  finally { if (browser) await browser.close(); if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; } await new Promise(resolve => backend.close(resolve)); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
