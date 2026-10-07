// Read-only production verification. Run through stdin in the frontend container.
// Credentials and session cookies stay in memory and are never printed.
const assert = require('node:assert/strict');

(async () => {
  const origin = 'https://app.nexoweb.co';
  const cookies = new Map();
  async function request(path, options = {}) {
    const response = await fetch(origin + path, {
      ...options, redirect: 'manual',
      headers: { ...options.headers, ...(cookies.size ? { Cookie: [...cookies].map(([name, value]) => name + '=' + value).join('; ') } : {}) },
    });
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(';', 1)[0], separator = pair.indexOf('=');
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  }
  assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, 'Existing administrator credentials are required');
  const csrf = await request('/api/auth/csrf');
  assert.equal(csrf.status, 200);
  const { csrfToken } = await csrf.json();
  const login = await request('/api/auth/callback/credentials', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, callbackUrl: origin + '/dashboard/settings', json: 'true' }),
  });
  assert.ok([200, 302].includes(login.status), 'Login failed');
  const session = await request('/api/auth/session');
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user?.role, 'admin');
  console.log('HTTPS administrator login: valid session');
  for (const tab of ['general', 'areas', 'localizacion', 'agenda', 'usuarios']) {
    const response = await request('/dashboard/settings?tab=' + tab);
    assert.equal(response.status, 200, tab);
    const html = await response.text();
    assert.ok(!html.includes('No se pudo cargar la administración'), tab + ' unavailable');
    assert.ok(html.includes('Equipo y accesos'), tab + ' missing administration navigation');
    console.log('Administration tab ' + tab + ': HTTP 200');
  }
  async function get(path) {
    const response = await request('/api/proxy/dashboard' + path);
    assert.equal(response.status, 200, path);
    const data = await response.json();
    console.log('Authenticated proxy ' + path.split('?')[0] + ': HTTP 200');
    return data;
  }
  const profile = await get('/tenant/profile');
  assert.ok(profile.id && profile.active);
  assert.ok(Object.hasOwn(profile, 'contactPhone'), 'Contact phone migration not exposed');
  assert.ok(Array.isArray(profile.activeModules), 'Business areas unavailable');
  await get('/access');
  const services = await get('/services');
  assert.ok(Array.isArray(services));
  const staff = await get('/staff');
  assert.ok(Array.isArray(staff));
  for (const member of staff) {
    assert.ok(!member.credential || !Object.hasOwn(member.credential, 'passwordHash'), 'Credential hash exposed');
    if (!member.active || !['vet', 'groomer'].includes(member.role)) continue;
    await get('/staff/' + encodeURIComponent(member.id) + '/availability-review');
    await get('/staff/' + encodeURIComponent(member.id) + '/services');
  }
  await get('/agenda-exceptions');
  const page = await request('/dashboard/calendar');
  assert.equal(page.status, 200);
  console.log('Agenda: HTTP 200; services=' + services.length + '; team=' + staff.length);
  const anonymousPage = await fetch(origin + '/dashboard/settings', { redirect: 'manual' });
  assert.ok([302, 307].includes(anonymousPage.status));
  assert.ok(anonymousPage.headers.get('location')?.includes('/login'));
  const anonymousProxy = await fetch(origin + '/api/proxy/dashboard/tenant/profile', { redirect: 'manual' });
  assert.equal(anonymousProxy.status, 401);
  console.log('Without session: administration redirects to login; proxy HTTP 401');
  console.log('Administration production reads passed. No configuration, appointments, messages or records changed.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
