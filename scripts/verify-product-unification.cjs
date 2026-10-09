// Browser verification against in-memory fixture contracts. No real DB or messages.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');
const { effectiveAccess } = require('../backend/src/services/dashboard-access.service');
const origin = 'http://localhost:3031';
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const future = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const directory = path.join(__dirname, '../.cache/product-unification');
let modules = ['veterinary', 'grooming', 'retail'], calls = [], failRegistration = false, showCases = false;
let owner = { id: 'owner-existing', name: 'Ana Prueba', phone: '0000000001', pets: [{ id: 'pet-existing', name: 'Toby', type: 'dog' }] };
const services = [{ id: 'service-vet', name: 'Consulta de prueba', category: 'veterinary', active: true, requiresAppointment: true, duration: 45, basePrice: 66000 }, { id: 'service-groom', name: 'Baño de prueba', category: 'grooming', active: true, requiresAppointment: true, duration: 60, basePrice: null }];
function visits(role) {
  return showCases ? ['veterinary', 'grooming'].filter(category => modules.includes(category) && (role === 'admin' || role === 'receptionist' || category === (role === 'vet' ? 'veterinary' : 'grooming'))).map(category => ({ id: 'case-' + category, date: today + 'T10:00:00-05:00', status: category === 'grooming' ? 'completed' : 'in_progress', serviceType: category === 'grooming' ? 'bath' : 'vet', serviceCategory: category, serviceName: category === 'grooming' ? 'Baño de prueba' : 'Consulta de prueba', petId: 'pet-existing', petName: 'Toby', petType: 'dog', userId: owner.id, clientName: owner.name, clientPhone: owner.phone, staffId: category === 'grooming' ? 'groomer' : 'vet', staffName: 'Profesional de prueba', finalPrice: 66000, priceResolution: null, startedAt: null, endedAt: null, hasMedicalRecord: false, groomingDeliveredAt: null, groomingNotes: '', groomingNotesVersion: 0, groomingNotesUpdatedAt: null })) : [];
}
const backend = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://test');
  const role = req.headers['x-staff-id'] || 'admin', tenant = req.headers['x-tenant-id'] || 'fixture-tenant';
  const send = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  let text = ''; for await (const chunk of req) text += chunk;
  const body = text ? JSON.parse(text) : null;
  if (url.pathname === '/api/internal/staff-login') {
    const requestedRole = body.email.split('@')[0];
    if (!['vet', 'groomer', 'receptionist'].includes(requestedRole) || body.password !== 'fixture-only-password') return send({}, 401);
    return send({ staffId: requestedRole, tenantId: 'fixture-tenant', name: requestedRole, email: body.email, role: requestedRole, sessionVersion: 1 });
  }
  calls.push({ path: url.pathname, method: req.method, tenant, role, body });
  if (req.method === 'POST' && url.pathname.endsWith('/clients/with-pets')) {
    if (failRegistration) return send({ error: 'No se pudo guardar el registro de prueba. Reintenta.' }, 503);
    if (body.phone === 'duplicate') return send({ error: 'Ya existe un cliente con ese teléfono.' }, 409);
    owner = { id: 'owner-created', name: body.name, phone: body.phone, pets: body.pets.map((pet, index) => ({ id: 'pet-created-' + index, name: pet.name, type: pet.type })) };
    return send({ owner: { id: owner.id, name: owner.name, phone: owner.phone }, pets: owner.pets }, 201);
  }
  if (req.method === 'POST' && url.pathname.endsWith('/pets')) {
    const pet = { id: 'pet-added', name: body.name, type: body.type, userId: owner.id }; owner.pets.push(pet); return send(pet, 201);
  }
  if (req.method === 'POST' && url.pathname.endsWith('/appointments')) return send({ id: 'appointment-created', ...body }, 201);
  if (req.method === 'DELETE') return send({ error: 'Deletion deliberately rejected in fixture' }, 409);
  if (req.method !== 'GET') return send({ error: 'Unsupported fixture operation' }, 405);
  if (url.pathname.endsWith('/access')) return send(effectiveAccess({ type: role, staffId: role === 'admin' ? null : role }, modules));
  if (url.pathname.endsWith('/tenant/profile')) return send({ id: tenant, name: 'Centro de prueba', slug: 'prueba', phone: '0000000000', contactPhone: null, email: '', address: '', plan: 'professional', activeModules: modules, businessHours: null });
  if (url.pathname.endsWith('/services')) return send(services.filter(service => modules.includes(service.category)));
  if (url.pathname.endsWith('/staff')) return send([{ id: 'vet', name: 'Médico de prueba', role: 'vet', active: true }, { id: 'groomer', name: 'Peluquero de prueba', role: 'groomer', active: true }]);
  if (url.pathname.endsWith('/appointments/available-slots')) return send({ slots: [9, 9.5, 10] });
  if (url.pathname.endsWith('/appointments/week')) return send({ appointments: visits(role), mondayYmd: today, weekStart: today, weekEnd: future });
  if (url.pathname.endsWith('/appointments/today')) return send(visits(role));
  if (url.pathname.endsWith('/medical-record')) return send({ error: 'No record' }, 404);
  if (/\/grooming\/pets\/[^/]+\/notes$/.test(url.pathname)) return send({ visits: [], nextCursor: null });
  if (/\/pets\/[^/]+$/.test(url.pathname)) return send({ id: 'pet-existing', name: 'Toby', type: 'dog', breed: null, owner: { id: owner.id, name: owner.name, phone: owner.phone }, _count: { appointments: 1, medicalRecords: 0 } });
  if (url.pathname.endsWith('/search')) return send({ users: [owner], pets: [] });
  if (/\/clients\/[^/]+$/.test(url.pathname)) return send({ ...owner, appointments: [], conversations: [], _count: { conversations: 0, appointments: 0 }, createdAt: new Date().toISOString() });
  if (url.pathname.endsWith('/clients')) {
    const item = { ...owner, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { pets: owner.pets.length, appointments: 0, conversations: 0 } };
    return send(url.searchParams.has('page') ? { data: [item], total: 1, totalPages: 1 } : [item]);
  }
  if (url.pathname.endsWith('/pets')) return send({ data: [], total: 0 });
  if (url.pathname.endsWith('/grooming/appointments')) return send({ appointments: visits(role).filter(visit => visit.serviceCategory === 'grooming'), hasMore: false });
  if (url.pathname.endsWith('/conversations')) return send({ data: [], pagination: { total: 0 } });
  if (url.pathname.endsWith('/cash/operational')) return send({ toReview: [], transactions: [], date: today, hasMore: false });
  if (url.pathname.endsWith('/inventory/products')) return send({ data: [], nextCursor: null });
  if (url.pathname.endsWith('/metrics/cashbox')) return send({ transactions: [], expenses: [] });
  return send([]);
});

(async () => {
  fs.mkdirSync(directory, { recursive: true });
  await new Promise((resolve, reject) => { backend.once('error', reject); backend.listen(3030, '127.0.0.1', resolve); });
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3031'], { cwd: path.join(__dirname, '../frontend'), env: { ...process.env, NEXT_VERIFY_BUILD: '1', API_URL: 'http://127.0.0.1:3030', NEXTAUTH_URL: origin, NEXTAUTH_SECRET: 'fixture-only-secret', AUTH_TRUST_HOST: 'true', INTERNAL_API_SECRET: 'fixture-only-token', ADMIN_EMAIL: 'admin@fixture.invalid', ADMIN_PASSWORD: 'fixture-only-password' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostics = '', browser;
  server.stdout.on('data', data => diagnostics = (diagnostics + data).slice(-1600)); server.stderr.on('data', data => diagnostics = (diagnostics + data).slice(-1600));
  async function login(role) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const { csrfToken } = await (await context.request.get(origin + '/api/auth/csrf')).json();
    await context.request.post(origin + '/api/auth/callback/credentials', { maxRedirects: 0, form: { csrfToken, email: role + '@fixture.invalid', password: 'fixture-only-password', callbackUrl: origin + '/dashboard', json: 'true' } });
    assert.equal((await (await context.request.get(origin + '/api/auth/session')).json()).user?.role, role);
    return context;
  }
  const overflow = page => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(origin + '/login')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 250)); }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await login('admin');
    try {
      for (const [alias, target, tab] of [['clients', 'contacto', null], ['pets', 'contacto', null], ['services', 'settings', 'localizacion'], ['staff', 'settings', 'usuarios'], ['reports', 'pos', 'reportes']]) {
        const response = await context.request.get(`${origin}/dashboard/${alias}?tenant=fixture-selected&search=Toby&client=case-owner&date=${today}`, { maxRedirects: 0 });
        assert([200, 307].includes(response.status()), 'Next redirect must be HTTP or streamed redirect');
        const html = response.status() === 200 ? await response.text() : '';
        const streamed = html.match(/<meta[^>]+http-equiv="refresh"[^>]+content="[^;]+;url=([^"]+)"/);
        const rsc = html.match(/NEXT_REDIRECT;replace;([^;]+);307;/);
        const href = response.headers().location || streamed?.[1] || rsc?.[1];
        assert(href, 'Missing HTTP or streamed redirect destination');
        const destination = new URL(href.replaceAll('&amp;', '&').replace(/\\+u0026/g, '&'), origin);
        assert.equal(destination.pathname, '/dashboard/' + target);
        assert.equal(destination.searchParams.get('tenant'), 'fixture-selected'); assert.equal(destination.searchParams.get('search'), 'Toby'); assert.equal(destination.searchParams.get('client'), 'case-owner'); assert.equal(destination.searchParams.get('date'), today);
        if (tab) assert.equal(destination.searchParams.get('tab'), tab);
      }
      console.log('PASS: five legacy entry points retain tenant, case and filters.');
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (let mask = 1; mask <= 7; mask++) {
        modules = ['veterinary', 'grooming', 'retail'].filter((_, index) => mask & (1 << index));
        await page.goto(origin + '/dashboard/settings?tenant=fixture-selected', { waitUntil: 'networkidle' });
        await page.getByText('Guía para configurar tu establecimiento', { exact: true }).click();
        const guide = page.locator('details').filter({ has: page.getByText('Guía para configurar tu establecimiento', { exact: true }) });
        assert.equal(await guide.getByRole('heading', { name: 'Servicios y precios' }).count(), modules.some(module => module !== 'retail') ? 1 : 0);
        assert.equal(await guide.getByRole('heading', { name: 'Equipo y accesos' }).count(), 1); assert.equal(await overflow(page), false);
      }
      console.log('PASS: setup guide adapts to seven module combinations, without mobile overflow.');
      modules = ['veterinary', 'grooming', 'retail'];
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(origin + '/dashboard?tenant=fixture-selected', { waitUntil: 'networkidle' });
      const search = page.getByPlaceholder('Buscar clientes o mascotas…');
      await search.fill('Toby'); await search.press('Enter'); await page.waitForURL('**/dashboard/contacto?**');
      assert.equal(new URL(page.url()).searchParams.get('tenant'), 'fixture-selected'); assert.equal(new URL(page.url()).searchParams.get('search'), 'Toby');
      console.log('PASS: global search Enter keeps the selected establishment.');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(origin + '/dashboard/calendar?tenant=fixture-selected&new=1', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Nueva cita', exact: true }).waitFor();
      await page.locator('#appointment-service').selectOption('service-vet');
      await page.locator('#appointment-professional').selectOption('vet');
      await page.locator('#appointment-date').fill(future);
      await page.locator('#appointment-hour').selectOption('9.5');
      const initialSlots = calls.filter(call => call.path.endsWith('/available-slots')).length;
      await page.getByRole('button', { name: 'Registrar cliente y mascota', exact: true }).click();
      await page.locator('#op-name').fill('María Primera'); await page.locator('#op-phone').fill('0000000002');
      await page.locator('input[id^="pet-name-"]').fill('Luna Primera');
      await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click();
      await page.getByRole('alertdialog').waitFor(); await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
      assert.equal(await page.locator('#op-name').inputValue(), 'María Primera');
      failRegistration = true;
      await page.locator('button[form="new-owner-pets-form"]').click();
      await page.getByText('No se pudo guardar el registro de prueba. Reintenta.', { exact: true }).waitFor();
      assert.equal(await page.locator('#op-name').inputValue(), 'María Primera'); failRegistration = false;
      await page.locator('button[form="new-owner-pets-form"]').click();
      await page.getByRole('heading', { name: 'Nuevo propietario + mascota(s)' }).waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#appointment-client').inputValue(), 'María Primera'); assert.equal(await page.locator('#appointment-pet').inputValue(), 'pet-created-0');
      for (const [id, expected] of [['service', 'service-vet'], ['professional', 'vet'], ['date', future], ['hour', '9.5']]) assert.equal(await page.locator('#appointment-' + id).inputValue(), expected);
      assert(calls.filter(call => call.path.endsWith('/available-slots')).length > initialSlots);
      await page.getByRole('button', { name: 'Agregar mascota a este cliente' }).click();
      assert.equal(await page.locator('#np-owner-phone').getAttribute('readonly'), '');
      await page.locator('#np-name').fill('Nala Segunda'); await page.locator('button[form="new-pet-form"]').click();
      await page.getByRole('heading', { name: 'Nueva mascota', exact: true }).waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#appointment-pet').inputValue(), 'pet-added');
      await page.screenshot({ path: path.join(directory, 'appointment-mobile.png'), fullPage: true }); assert.equal(await overflow(page), false);
      await page.getByRole('button', { name: 'Crear cita', exact: true }).click();
      await page.getByRole('heading', { name: 'Nueva cita', exact: true }).waitFor({ state: 'hidden' });
      const created = calls.filter(call => call.method === 'POST' && call.path.endsWith('/appointments')).at(-1);
      assert.deepEqual(created.body, { userId: 'owner-created', petId: 'pet-added', serviceId: 'service-vet', staffId: 'vet', dateKey: future, hour: 9.5 });
      assert(calls.filter(call => call.method === 'POST').every(call => call.tenant === 'fixture-selected'));
      console.log('PASS: register owner+pet, preserve draft, protect unsaved edits, retain failed input, add pet, revalidate slots and save one scoped appointment.');
      assert.equal(errors.length, 0, errors.join('\n'));
      await page.goto(origin + '/dashboard/contacto?tenant=fixture-selected', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Eliminar cliente/ }).first().click();
      await page.getByRole('alertdialog').waitFor(); await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(calls.filter(call => call.method === 'DELETE').length, 0);
      console.log('PASS: cancel shared deletion confirmation does not issue a write.');
      showCases = true;
      await page.goto(origin + '/dashboard?tenant=fixture-selected', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Abrir cita de/ }).first().click();
      const summary = page.getByRole('region', { name: 'Resumen de la atención' });
      await summary.waitFor();
      assert((await summary.innerText()).includes(owner.name)); assert((await summary.innerText()).includes('Consulta de prueba'));
      await page.getByRole('button', { name: 'Cambiar precio', exact: true }).click(); await page.locator('#appointment-price').fill('70000');
      await page.keyboard.press('Escape'); await page.getByRole('alertdialog').waitFor();
      await page.getByRole('button', { name: 'Seguir editando', exact: true }).click(); assert.equal(await page.locator('#appointment-price').inputValue(), '70000');
      await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
      await page.getByRole('heading', { name: 'Cita de Toby', exact: true }).waitFor({ state: 'hidden' });
      assert.equal(calls.filter(call => call.method === 'PATCH').length, 0);
      await page.goto(origin + '/dashboard/consultas?tenant=fixture-selected&date=' + today, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Registrar atención', exact: true }).first().click();
      await page.getByRole('heading', { name: 'Historia clínica de Toby', exact: true }).waitFor();
      await summary.waitFor(); assert((await summary.innerText()).includes(owner.name));
      assert.equal(await page.getByText('No se pudo comprobar el registro de esta consulta.', { exact: false }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Guardar consulta', exact: true }).isEnabled(), true);
      await page.screenshot({ path: path.join(directory, 'clinical-summary-mobile.png'), fullPage: true }); assert.equal(await overflow(page), false);
      await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
      await page.goto(origin + '/dashboard/peluqueria?tenant=fixture-selected&date=' + today, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Notas de la atención', exact: true }).first().click();
      await summary.waitFor(); assert((await summary.innerText()).includes('Baño de prueba')); assert((await summary.innerText()).includes(owner.name));
      await page.screenshot({ path: path.join(directory, 'grooming-summary-mobile.png'), fullPage: true }); assert.equal(await overflow(page), false);
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log('PASS: shared appointment, clinical and grooming context; unsaved price protected without writes; mobile dialogs have no overflow or runtime errors.');
      showCases = false;
    } finally { await context.close(); }
    for (const role of ['receptionist', 'vet', 'groomer']) {
      const context = await login(role), page = await context.newPage(); calls = [];
      try {
        await page.goto(origin + '/dashboard?tenant=fixture-selected', { waitUntil: 'networkidle' });
        await page.getByText('Ayuda para tu operación diaria', { exact: true }).click();
        const access = effectiveAccess({ type: role, staffId: role }, modules), c = access.capabilities;
        const help = page.locator('details').filter({ has: page.getByText('Ayuda para tu operación diaria', { exact: true }) });
        assert.equal(await help.getByRole('heading', { name: 'Guardar una consulta' }).count(), c.clinical ? 1 : 0);
        assert.equal(await help.getByRole('heading', { name: 'Confirmar un cobro existente' }).count(), c.cash ? 1 : 0);
        assert.equal(await help.getByRole('heading', { name: 'Atender y entregar una mascota' }).count(), c.grooming ? 1 : 0);
        assert.equal(await overflow(page), false); assert(calls.every(call => call.tenant === 'fixture-tenant'));
        console.log('PASS: ' + role + ' operation help follows authenticated capabilities and tenant.');
      } finally { await context.close(); }
    }
  } catch (error) { throw new Error(error.stack + '\n' + diagnostics); }
  finally { if (browser) await browser.close(); if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; } await new Promise(resolve => backend.close(resolve)); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
