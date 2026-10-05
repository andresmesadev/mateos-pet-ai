// Read-only checks using the administrator credentials already configured in
// the frontend container. Run through stdin; credentials/cookies stay in memory.
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
    body: new URLSearchParams({ csrfToken, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, callbackUrl: origin + '/dashboard/recuperacion', json: 'true' }),
  });
  assert.ok([200, 302].includes(login.status), 'Login failed');
  const session = await request('/api/auth/session');
  assert.equal(session.status, 200);
  const identity = await session.json();
  assert.equal(identity.user?.role, 'admin', 'Administrator session was not established');
  console.log('HTTPS administrator login: valid session');
  for (const path of ['/dashboard/recuperacion', '/dashboard/inventory', '/dashboard/pos']) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(!html.includes('El servidor de datos no está disponible'), path + ' data unavailable');
    if (path === '/dashboard/recuperacion') assert.ok(html.includes('Seguimiento de clientes'));
    console.log(path + ': HTTP 200');
  }
  for (const path of ['/dashboard/opportunities?page=1', '/dashboard/clients/inactive?page=1', '/dashboard/campaigns/reactivation/context', '/dashboard/inventory/context', '/dashboard/inventory/products?page=1']) {
    const response = await request('/api/proxy' + path);
    assert.equal(response.status, 200, path);
    await response.json();
    console.log('Authenticated proxy ' + path + ': HTTP 200');
  }
  const anonymousPage = await fetch(origin + '/dashboard/recuperacion', { redirect: 'manual' });
  assert.ok([302, 307].includes(anonymousPage.status));
  assert.ok(anonymousPage.headers.get('location')?.includes('/login'));
  const anonymousProxy = await fetch(origin + '/api/proxy/dashboard/opportunities?page=1', { redirect: 'manual' });
  assert.equal(anonymousProxy.status, 401);
  console.log('Without session: dashboard redirects to login; proxy HTTP 401');
  console.log('HTTPS checks passed; no messages, sales or clinical records created.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
