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
const directory = path.join(__dirname, '../.cache/workspace-continuity');
let modules = ['veterinary', 'grooming', 'retail'], calls = [], failRegistration = false, showCases = true, failSearch = false, failSend = false, denyContacts = false, sendGate = null;
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
  calls.push({ path: url.pathname, method: req.method, tenant, role, body, query: url.search });
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
  if (req.method === 'POST' && url.pathname.endsWith('/send')) { if (sendGate) await sendGate; return send(failSend ? {error:'Prueba de fallo de envío'} : {message:{id:'sent-fixture',role:'assistant',origin:'manual',content:body.message,createdAt:new Date().toISOString()}}, failSend ? 503 : 200); }
  if (req.method !== 'GET') return send({ error: 'Unsupported fixture operation' }, 405);
  if (url.pathname.endsWith('/access')) { const access = effectiveAccess({ type: role, staffId: role === 'admin' ? null : role }, modules); if (denyContacts) access.capabilities.contacts = false; return send(access); }
  if (url.pathname.endsWith('/tenant/profile')) return send({ id: tenant, name: 'Centro de prueba', slug: 'prueba', phone: '0000000000', contactPhone: null, email: '', address: '', plan: 'professional', activeModules: modules, businessHours: null });
  if (url.pathname.endsWith('/services')) return send(services.filter(service => modules.includes(service.category)));
  if (url.pathname.endsWith('/staff')) return send([{ id: 'vet', name: 'Médico de prueba', role: 'vet', active: true }, { id: 'groomer', name: 'Peluquero de prueba', role: 'groomer', active: true }]);
  if (url.pathname.endsWith('/appointments/available-slots')) return send({ slots: [9, 9.5, 10] });
  if (url.pathname.endsWith('/appointments/week')) return send({ appointments: visits(role), mondayYmd: today, weekStart: today, weekEnd: future });
  if (url.pathname.endsWith('/appointments/today')) return send(visits(role));
  if (url.pathname.endsWith('/medical-record')) return send({ error: 'No record' }, 404);
  if (/\/grooming\/pets\/[^/]+\/notes$/.test(url.pathname)) return send({ visits: [], nextCursor: null });
  if (/\/pets\/[^/]+$/.test(url.pathname)) return send({ id: 'pet-existing', name: 'Toby', type: 'dog', breed: null, owner: { id: owner.id, name: owner.name, phone: owner.phone }, _count: { appointments: 1, medicalRecords: 0 } });
  if (url.pathname.endsWith('/appointments/consultations/search')) return send({appointments:visits(role).filter(visit=>visit.serviceCategory==='veterinary'),hasMore:false});
  if (url.pathname.endsWith('/search')) return failSearch ? send({error:'Unavailable fixture'},503) : send({ users: [owner], pets: [{id:'pet-existing',name:'Toby',type:'dog',breed:null,owner}] });
  if (/\/clients\/[^/]+$/.test(url.pathname)) return send({ ...owner, appointments: [], conversations: [], _count: { conversations: 0, appointments: 0 }, createdAt: new Date().toISOString() });
  if (url.pathname.endsWith('/clients')) {
    const item = { ...owner, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { pets: owner.pets.length, appointments: 0, conversations: 0 } };
    return send(url.searchParams.has('page') ? { data: [item], total: 1, totalPages: 1 } : [item]);
  }
  if (url.pathname.endsWith('/pets')) return send({ data: [], total: 0 });
  if (url.pathname.endsWith('/grooming/appointments')) return send({ appointments: visits(role).filter(visit => visit.serviceCategory === 'grooming'), hasMore: false });
  if (url.pathname.endsWith('/conversations')) return send({ data: [{id:'chat-fixture',userId:owner.id,tenantId:tenant,name:owner.name,phone:owner.phone,status:'en_atencion_humana',updatedAt:new Date().toISOString(),lastMessageAt:new Date().toISOString(),requires_human_attention:true,controlVersion:1}], pagination: {page:1,limit:25,total:1,totalPages:1} });
  if (url.pathname.endsWith('/conversations/owner-existing/messages')) return send({conversation:{id:'chat-fixture',userId:owner.id,tenantId:tenant,name:owner.name,phone:owner.phone,status:'en_atencion_humana',assignment:{actorId:'admin',name:'Prueba',role:'admin',since:new Date().toISOString()},controlVersion:1,updatedAt:new Date().toISOString(),requires_human_attention:true},messages:[],viewer:{role,isMine:true,canRelease:true,canTakeOver:true,canCreateAppointment:true}});
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
  server.stdout.on('data', data => diagnostics = (diagnostics + data).slice(-1200)); server.stderr.on('data', data => diagnostics = (diagnostics + data).slice(-1200));
  async function authenticate(context, role = 'admin') {
    const { csrfToken } = await (await context.request.get(origin + '/api/auth/csrf')).json();
    await context.request.post(origin + '/api/auth/callback/credentials', { maxRedirects: 0, form: { csrfToken, email: role + '@fixture.invalid', password: 'fixture-only-password', callbackUrl: origin + '/dashboard', json: 'true' } });
    assert.equal((await (await context.request.get(origin + '/api/auth/session')).json()).user?.role, role);
  }
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(origin + '/login')).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 250)); }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await authenticate(context);
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    const navigate = async (route, tenant = 'fixture-selected') => { await page.goto(origin + '/dashboard/' + route + (route.includes('?') ? '&' : '?') + 'tenant=' + tenant, { waitUntil: 'networkidle' }); };
    const home = async () => { await page.getByRole('link', { name: 'Inicio', exact: true }).first().click(); await page.waitForURL(url => url.pathname === '/dashboard'); };
    // Inventory: explicit URL, reload, departure, new entry, and history.
    await navigate('inventory?status=low&q=champu&use=grooming&inactive=1');
    const productSearch = page.getByPlaceholder('Nombre, código interno o código de barras');
    await productSearch.waitFor(); assert.equal(await productSearch.inputValue(), 'champu');
    await productSearch.fill('alimento');
    await home(); await page.getByRole('link', { name: 'Inventario', exact: true }).first().click();
    await productSearch.waitFor(); assert.equal(await productSearch.inputValue(), 'alimento');
    assert.equal(new URL(page.url()).searchParams.get('status'), 'low');
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await productSearch.inputValue(), 'alimento');
    await navigate('inventory?status=expired'); assert.equal(await productSearch.inputValue(), '');
    assert.equal(new URL(page.url()).searchParams.get('inactive'), '0');
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click(); await page.waitForURL(url => url.searchParams.get('status') === '');
    await page.goBack({ waitUntil: 'networkidle' }); await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]')?.textContent?.includes('Con unidades vencidas'));
    assert.equal(new URL(page.url()).searchParams.get('status'), 'expired');
    await page.goForward({ waitUntil: 'networkidle' }); await page.waitForURL(url => url.searchParams.get('status') === '');
    await productSearch.fill('privado'); await navigate('inventory', 'fixture-other'); assert.equal(await productSearch.inputValue(), '');
    console.log('PASS: inventory return, reload, explicit URL, clear, Back/Forward and tenant separation.');
    // Grooming: restored date/team/stage and live server fetch.
    await navigate('peluqueria?date=2026-09-28&view=history&stage=Entregadas&staff=groomer');
    assert.equal(await page.locator('#grooming-date').inputValue(), '2026-09-28'); assert.equal(await page.locator('#grooming-staff').inputValue(), 'groomer');
    await home(); await page.getByRole('link', { name: 'Peluquería', exact: true }).first().click(); await page.locator('#grooming-date').waitFor();
    assert.equal(await page.locator('#grooming-date').inputValue(), '2026-09-28'); assert.equal(new URL(page.url()).searchParams.get('stage'), 'Entregadas');
    await page.locator('#grooming-search').fill('Toby'); await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.locator('#grooming-search').inputValue(), 'Toby');
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click(); assert.equal(await page.locator('#grooming-date').inputValue(), today); assert.equal(await page.locator('#grooming-search').inputValue(), '');
    await navigate('peluqueria?date=2026-02-30&staff=removed&stage=bad'); assert.equal(await page.locator('#grooming-date').inputValue(), today); assert.equal(await page.locator('#grooming-staff').inputValue(), 'all');
    console.log('PASS: grooming date, staff, stage and search continuity; invalid options and clearing.');
    // Clinical: restore searched history and filtering without retaining server data.
    await navigate('consultas?date=2026-09-28&scope=week&staff=vet&care=En%20atenci%C3%B3n&q=Toby');
    await page.locator('#buscar-consulta').waitFor(); assert.equal(await page.locator('#buscar-consulta').inputValue(), 'Toby'); assert.equal(await page.locator('#consultas-profesional').inputValue(), 'vet');
    await page.getByRole('link', { name: 'Ver historia', exact: true }).first().waitFor();
    await page.getByRole('link', { name: 'Ver historia', exact: true }).first().click(); await page.waitForURL(url => url.pathname === '/dashboard/contacto');
    assert.equal(new URL(page.url()).searchParams.get('tenant'), 'fixture-selected');
    await page.goBack({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#buscar-consulta').inputValue(), 'Toby');
    await home(); await page.getByRole('link', { name: 'Consultas veterinarias', exact: true }).first().click();
    await page.locator('#buscar-consulta').waitFor(); assert.equal(await page.locator('#buscar-consulta').inputValue(), 'Toby');
    assert.equal(new URL(page.url()).searchParams.get('date'), '2026-09-28');
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click(); assert.equal(await page.locator('#buscar-consulta').inputValue(), ''); assert.equal(new URL(page.url()).searchParams.get('scope'), 'day');
    await navigate('consultas?staff=removed&scope=invalid&date=2026-02-30'); assert.equal(await page.locator('#consultas-profesional').inputValue(), 'all');
    console.log('PASS: veterinary history search, week and professional restoration; invalid URL and clear.');
    // Mobile: same scoped search, keyboard selection, focus and retry.
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 }); await navigate('inventory');
      const trigger = page.getByRole('button', { name: 'Abrir búsqueda de clientes y mascotas', exact: true });
      await trigger.click(); const dialog = page.getByRole('dialog'), input = dialog.getByRole('combobox');
      await input.waitFor(); assert.equal(await input.evaluate(element => element === document.activeElement), true);
      await input.fill('Toby'); await dialog.getByRole('option', { name: /Toby/ }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(directory, 'search-' + width + '.png') });
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    }
    await page.getByRole('button', { name: 'Abrir búsqueda de clientes y mascotas', exact: true }).click();
    let dialog = page.getByRole('dialog'), input = dialog.getByRole('combobox');
    failSearch = true; await input.fill('Error'); await dialog.getByRole('button', { name: 'Reintentar búsqueda' }).waitFor(); failSearch = false;
    await dialog.getByRole('button', { name: 'Reintentar búsqueda' }).click(); await dialog.getByRole('option', { name: /Toby/ }).waitFor();
    await input.press('ArrowDown'); await input.press('ArrowDown'); await input.press('Enter');
    await page.waitForURL(url => url.pathname === '/dashboard/contacto' && url.searchParams.get('pet') === 'pet-existing');
    assert.equal(new URL(page.url()).searchParams.get('tenant'), 'fixture-selected');
    console.log('PASS: 320/390px mobile search, focus return, keyboard pet selection, error/retry and tenant context.');
    denyContacts = true; await navigate('inventory'); assert.equal(await page.getByRole('button', { name: 'Abrir búsqueda de clientes y mascotas' }).count(), 0); denyContacts = false;
    console.log('PASS: mobile search entry disappears when contact access is revoked.');
    // Drafts: no send on recovery, failed send retained, success clears.
    await page.setViewportSize({ width: 1440, height: 1000 }); await navigate('conversations?conversation=owner-existing');
    const reply = page.locator('#whatsapp-reply'); await reply.waitFor(); await reply.fill('Borrador de prueba');
    await home(); await navigate('conversations?conversation=owner-existing'); await reply.waitFor(); assert.equal(await reply.inputValue(), 'Borrador de prueba');
    await page.getByText('Borrador recuperado', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await reply.inputValue(), 'Borrador de prueba'); assert.equal(calls.filter(call => call.method === 'POST' && call.path.endsWith('/send')).length, 0);
    await page.getByRole('button', { name: 'Descartar borrador', exact: true }).click(); await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click(); assert.equal(await reply.inputValue(), 'Borrador de prueba');
    await page.getByRole('button', { name: 'Descartar borrador', exact: true }).click(); await page.getByRole('button', { name: 'Descartar', exact: true }).click(); assert.equal(await reply.inputValue(), '');
    await reply.fill('Mensaje manual'); failSend = true; await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'texto no se ha borrado' }).waitFor(); assert.equal(await reply.inputValue(), 'Mensaje manual');
    failSend = false; await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click(); await page.waitForFunction(() => document.querySelector('#whatsapp-reply')?.value === '');
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await reply.inputValue(), '');
    await reply.fill('Respuesta anterior'); let release; sendGate = new Promise(resolve => release = resolve);
    await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('button[aria-label="Enviando mensaje"]') !== null);
    await home(); await navigate('conversations?conversation=owner-existing'); await reply.fill('Texto nuevo tras regresar');
    sendGate = null; release(); await page.waitForTimeout(500); assert.equal(await reply.inputValue(), 'Texto nuevo tras regresar');
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await reply.inputValue(), 'Texto nuevo tras regresar');
    console.log('PASS: late confirmation does not erase a newer draft after leaving and returning.');
    await reply.fill('Privado del primer establecimiento'); await navigate('conversations?conversation=owner-existing', 'fixture-other'); assert.equal(await reply.inputValue(), '');
    await navigate('conversations?conversation=owner-existing'); assert.equal(await reply.inputValue(), 'Privado del primer establecimiento');
    await page.evaluate(() => { for (let i = 0; i < sessionStorage.length; i++) { const key = sessionStorage.key(i); if (key?.endsWith('whatsapp-drafts')) { const value = JSON.parse(sessionStorage.getItem(key)); value.savedAt = Date.now() - 7200001; sessionStorage.setItem(key, JSON.stringify(value)); } } });
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await reply.inputValue(), '');
    await reply.fill('No conservar al cerrar sesión');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await page.waitForURL('**/login');
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('mateos:workspace:')).length), 0);
    await authenticate(context, 'receptionist'); await navigate('conversations?conversation=owner-existing'); assert.equal(await reply.inputValue(), '');
    assert.equal(calls.filter(call => call.method === 'POST' && call.path.endsWith('/send')).length, 3);
    console.log('PASS: WhatsApp recovery, reload, discard cancel/confirm, manual failure/success, TTL, tenant and sign-out/user separation; no automatic messages.');
    assert.equal(errors.length, 0, errors.join('\n'));
    assert(calls.some(call => call.path.endsWith('/inventory/products') && call.tenant === 'fixture-selected'));
    assert(calls.some(call => call.path.endsWith('/grooming/appointments') && call.query.includes('2026-09-28')));
    console.log('PASS: fresh backend reads and zero browser runtime errors.');
    await context.close();
  } catch (error) { console.error(error.stack); console.error(diagnostics); process.exitCode = 1; }
  finally { await browser?.close(); const stopped = once(server, 'exit'); server.kill(); await Promise.race([stopped, new Promise(resolve => setTimeout(resolve, 3000))]); await new Promise(resolve => backend.close(resolve)); }
})();

