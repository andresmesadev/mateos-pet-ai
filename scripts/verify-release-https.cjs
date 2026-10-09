// Read-only release smoke check through the production HTTPS authentication/proxy.
// Run through stdin in the frontend container; credentials/cookies stay in memory.
const assert = require('node:assert/strict');
const origin = 'https://app.nexoweb.co';
(async () => {
  const cookies = new Map();
  async function request(path, options = {}) {
    const response = await fetch(origin + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(25_000), headers: { ...options.headers, ...(cookies.size ? {Cookie: [...cookies].map(([key,value]) => key+'='+value).join('; ')} : {}) }});
    for (const raw of response.headers.getSetCookie()) {
      const pair=raw.split(';',1)[0], i=pair.indexOf('='); cookies.set(pair.slice(0,i),pair.slice(i+1));
    }
    return response;
  }
  assert(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, 'Existing administrator credentials required');
  const csrf=await request('/api/auth/csrf'); assert.equal(csrf.status,200);
  const {csrfToken}=await csrf.json();
  const login=await request('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken,email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,callbackUrl:origin+'/dashboard',json:'true'})});
  assert([200,302].includes(login.status),'Login failed');
  const session=await request('/api/auth/session'); assert.equal(session.status,200); assert.equal((await session.json()).user?.role,'admin');
  console.log('HTTPS administrator authentication: PASS');
  for (const path of ['/dashboard','/dashboard/calendar','/dashboard/consultas','/dashboard/peluqueria','/dashboard/contacto','/dashboard/pets','/dashboard/conversations','/dashboard/pos?tab=venta','/dashboard/pos?tab=caja','/dashboard/pos?tab=historial','/dashboard/pos?tab=reportes','/dashboard/inventory','/dashboard/recuperacion','/dashboard/settings']) {
    const response=await request(path); assert.equal(response.status,200,path); await response.text();
  }
  console.log('14 authenticated dashboard destinations: HTTP 200');
  async function get(path) {const response=await request('/api/proxy/dashboard'+path);assert.equal(response.status,200,path);return response.json();}
  const profile=await get('/tenant/profile'); assert(profile.id && profile.active);
  const access=await get('/access'); assert(access.capabilities?.administration && access.capabilities.cash);
  for (const scope of ['day','pending']) {
    const cash=await get('/cash/operational?scope='+scope+'&pageSize=10');
    assert.equal(cash.scope,scope); assert(Array.isArray(cash.data)); assert(cash.data.length<=10);
    assert(Number.isInteger(cash.total) && cash.total>=cash.data.length);
    assert(Number.isInteger(cash.pendingCount) && cash.pendingCount>=0);
    assert.equal(cash.summary.activeCount,cash.total); assert.equal(cash.totalRegistered,cash.summary.activeTotal);
    assert.equal(cash.totalPages,Math.max(1,Math.ceil(cash.total/cash.pageSize)));
    assert.equal(cash.hasMore,cash.page<cash.totalPages);
    assert.equal(Object.values(cash.summaryCash.methods).reduce((sum,x)=>sum+x.count,cash.summaryCash.reviewCount),cash.total);
  }
  console.log('Authenticated Caja day/pending: paginated contract and complete totals PASS');
  const duplicate=await request('/api/proxy/dashboard/cash/operational?scope=pending&scope=day'); assert.equal(duplicate.status,400);
  console.log('Ambiguous cash parameters rejected: HTTP 400');
  const services=await get('/services'); assert(Array.isArray(services));
  const products=await get('/inventory/products'); assert(Array.isArray(products.data));
  console.log('Authenticated services and inventory contracts: PASS');
  const page=await fetch(origin+'/dashboard',{redirect:'manual',signal:AbortSignal.timeout(20_000)}); assert([302,307].includes(page.status)); assert(page.headers.get('location')?.includes('/login'));
  const anonymous=await fetch(origin+'/api/proxy/dashboard/cash/operational',{redirect:'manual',signal:AbortSignal.timeout(20_000)}); assert.equal(anonymous.status,401);
  console.log('Anonymous dashboard/proxy denied: redirect to login / HTTP 401');
  console.log('Release HTTPS smoke passed. No business writes or outgoing messages.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
