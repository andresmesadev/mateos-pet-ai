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
const directory = path.join(__dirname, '../.cache/home-continuity');
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
  calls.push({ path: url.pathname.replace('/api/dashboard', ''), tenant, role, method: req.method, status: url.searchParams.get('status') });
  if (url.pathname.endsWith('/access')) return mode.accessDeny ? send({error:'Access revoked'},403) : send(access);
  if (url.pathname.endsWith('/tenant/profile')) return send({ id: tenant, name: 'Centro de prueba', activeModules: mode.modules });
  if (mode.fail && /\/inventory\/products|\/cash\/operational|\/metrics\/cashbox/.test(url.pathname)) return send({ error: 'Simulated read failure' }, 503);
  let rows = mode.empty ? [] : [appointment('historia', 'veterinary', 'completed'), appointment('entrega', 'grooming', 'completed'), ...Array.from({ length: 8 }, (_, i) => appointment('espera-' + i, 'veterinary', 'arrived'))];
  rows = rows.filter(row => mode.modules.includes(row.serviceCategory) && (role === 'admin' || role === 'receptionist' || row.serviceCategory === (role === 'vet' ? 'veterinary' : 'grooming')));
  if (url.pathname.endsWith('/appointments/today')) return mode.agendaFail ? send({error:'Fixture read failure'},503) : send(rows);
  if (url.pathname.endsWith('/appointments/week')) return send({ appointments: rows });
  if (url.pathname.endsWith('/grooming/appointments')) return send({ appointments: rows.filter(row => row.serviceCategory === 'grooming'), hasMore: mode.partial });
  if (url.pathname.endsWith('/conversations')) return send({ data: mode.empty ? [] : [{ id: 'chat', name: 'Cliente de prueba', requires_human_attention: true, updatedAt: new Date().toISOString() }], pagination: { page: 1, limit: 2, total: mode.empty ? 0 : 1, totalPages: 1 } });
  if (url.pathname.endsWith('/cash/operational')) return send({ toReview: mode.empty ? [] : ['charge'], transactions: [], date: today, hasMore: mode.partial, totalRegistered: 0 });
  if (url.pathname.endsWith('/inventory/products')) return send({ data: mode.empty ? [] : [{ id: 'product', name: 'Producto de prueba', available: '0', physical: '0', expired: '0', uses: ['retail'], active: true, stockMinimum: 1, lowStock: true, lots: [] }], nextCursor: mode.partial ? 'cursor' : null });
  if (url.pathname.endsWith('/next-actions/upcoming')) return send(mode.empty ? [] : mode.followupDates ? mode.followupDates.map((dueAt,index)=>({id:'follow-'+index,petId:'pet-follow-'+index,petName:'Seguimiento '+index,type:'control',dueAt})) : [{ id: 'follow', petId: 'pet-follow', petName: 'Control pendiente', type: mode.modules.includes('veterinary') ? 'control' : 'grooming', dueAt: `${today}T05:00:00Z` }]);
  if (url.pathname.endsWith('/metrics/cashbox')) return send({ transactions: mode.empty ? [] : [{ total: 66000.3 }], expenses: mode.empty ? [] : [{ amount: 10000.05 }] });
  return send([]);
});


(async () => {
  await new Promise((resolve,reject)=>{backend.once('error',reject);backend.listen(backendPort,'127.0.0.1',resolve)});
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(frontendPort)],{cwd:path.join(__dirname,'../frontend'),env:{...process.env,NEXT_VERIFY_BUILD:'1',API_URL:'http://127.0.0.1:3030',NEXTAUTH_URL:origin,NEXTAUTH_SECRET:'fixture-only-home-secret',AUTH_TRUST_HOST:'true',INTERNAL_API_SECRET:'fixture-only-home-token',ADMIN_EMAIL:'admin@fixture.invalid',ADMIN_PASSWORD:'fixture-only-password'},stdio:['ignore','pipe','pipe']});
  let browser,diagnostics='';server.stdout.on('data',d=>diagnostics=(diagnostics+d).slice(-1500));server.stderr.on('data',d=>diagnostics=(diagnostics+d).slice(-1500));
  async function login(role) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const {csrfToken}=await(await context.request.get(origin+'/api/auth/csrf')).json();
    await context.request.post(origin+'/api/auth/callback/credentials',{maxRedirects:0,form:{csrfToken,email:role+'@fixture.invalid',password:'fixture-only-password',callbackUrl:origin+'/dashboard',json:'true'}});
    assert.equal((await(await context.request.get(origin+'/api/auth/session')).json()).user?.role,role);return context;
  }
  const todayCalls=()=>calls.filter(call=>call.path==='/appointments/today').length;
  try {
    for(let i=0;i<60;i++){try{if((await fetch(origin+'/login')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,250))}
    browser=await chromium.launch({channel:'chrome',headless:true});

    const context=await login('admin'),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const url=(query='',tenant='fixture-selected')=>origin+'/dashboard?tenant='+tenant+(query?'&'+query:'');
    const enter=async(query='',tenant='fixture-selected')=>{await page.goto(url(query,tenant),{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Necesita atención',exact:true}).waitFor()};
    const selectFilter=async(label)=>{await page.getByRole('region',{name:'Resumen de la jornada'}).getByRole('button',{name:new RegExp('^'+label+':')}).click()};
    const selectedFilter=async(label)=>assert.equal(await page.getByRole('region',{name:'Resumen de la jornada'}).getByRole('button',{name:new RegExp('^'+label+':')}).getAttribute('aria-pressed'),'true');
    const pager=page.getByRole('navigation',{name:'Páginas de prioridades'});
    await enter();await selectFilter('En espera');await pager.getByRole('button',{name:'Página 2 de prioridades',exact:true}).click();
    await page.goto(origin+'/login',{waitUntil:'networkidle'});let reads=todayCalls();await enter();
    await selectedFilter('En espera');
    assert.equal(await pager.getByRole('button',{name:'Página 2 de prioridades',exact:true}).getAttribute('aria-current'),'page');
    assert(todayCalls()>reads,'Returning retrieves current appointments');
    await page.reload({waitUntil:'networkidle'});await selectedFilter('En espera');
    assert.equal(await pager.getByRole('button',{name:'Página 2 de prioridades',exact:true}).getAttribute('aria-current'),'page');
    console.log('PASS: filter and priority page return after leaving and reload; data is read again.');
    await enter('dayFilter=completed&priorityPage=1');await selectedFilter('Terminadas');
    await enter('review=1');assert.equal(await page.getByRole('button',{name:/^Por revisar/}).getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'Todas las citas',exact:true}).click();
    await page.goBack({waitUntil:'networkidle'});assert.equal(await page.getByRole('button',{name:/^Por revisar/}).getAttribute('aria-pressed'),'true');
    await page.goForward({waitUntil:'networkidle'});assert.equal(await page.getByRole('button',{name:'Todas las citas',exact:true}).getAttribute('aria-pressed'),'true');
    await enter('review=0');assert.equal(await page.getByRole('button',{name:'Todas las citas',exact:true}).getAttribute('aria-pressed'),'true');
    await enter('dayFilter=bad&priorityPage=999');assert.equal(new URL(page.url()).searchParams.get('dayFilter'),'all');
    assert.equal(new URL(page.url()).searchParams.get('priorityPage'),'3');
    await enter('dayFilter=waiting&dayFilter=completed&priorityPage=oops');
    assert.equal(new URL(page.url()).searchParams.get('dayFilter'),'all');assert.equal(new URL(page.url()).searchParams.get('priorityPage'),'1');
    console.log('PASS: explicit entries and legacy review links override storage; Back/Forward and invalid parameters normalize.');
    await selectFilter('En espera');await pager.getByRole('button',{name:'Página 2 de prioridades',exact:true}).click();
    await enter('','fixture-other');assert.equal(await page.getByRole('button',{name:'Todas las citas',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(new URL(page.url()).searchParams.get('priorityPage'),'1');
    await selectFilter('Terminadas');await enter();await selectedFilter('En espera');
    assert.equal(new URL(page.url()).searchParams.get('priorityPage'),'2');
    await enter('','fixture-other');await selectedFilter('Terminadas');await enter();
    mode.empty=true;await enter();assert.equal(new URL(page.url()).searchParams.get('priorityPage'),'1');
    mode.empty=false;await enter();assert.equal(new URL(page.url()).searchParams.get('priorityPage'),'1');
    console.log('PASS: preferences stay tenant-scoped and a shorter list corrects the saved page.');
    await page.evaluate(()=>{for(const key of Object.keys(sessionStorage)){if(key.includes('home-agenda')||key.includes('home-priorities')){const value=JSON.parse(sessionStorage.getItem(key));value.savedAt=Date.now()-12*60*60*1000;sessionStorage.setItem(key,JSON.stringify(value));}}});
    await enter();assert.equal(await page.getByRole('button',{name:'Todas las citas',exact:true}).getAttribute('aria-pressed'),'true');
    await selectFilter('En espera');mode.modules=['retail'];const before=calls.filter(call=>call.path==='/next-actions/upcoming').length;
    await enter();assert.equal(await page.getByRole('region',{name:'Resumen de la jornada'}).count(),0);
    assert.equal(new URL(page.url()).searchParams.get('dayFilter'),'all');
    assert.equal(calls.filter(call=>call.path==='/next-actions/upcoming').length,before);
    mode.modules=['veterinary','grooming','retail'];await enter();
    assert.equal(await page.getByRole('button',{name:'Todas las citas',exact:true}).getAttribute('aria-pressed'),'true');
    console.log('PASS: expired preferences reset; inactive agenda and follow-up modules do not restore forbidden views or reads.');
    const dayOffset=(days)=>new Date(Date.parse(today+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
    mode.followupDates=[today+'T05:00:00Z',dayOffset(-3)+'T05:00:00Z',dayOffset(1)+'T05:00:00Z'];
    await enter();await pager.getByRole('button',{name:'Página 3 de prioridades',exact:true}).click();
    const follow=page.locator('article[data-home-task="Seguimientos por revisar"]');
    await follow.getByText(/^Para hoy/).waitFor();await follow.getByText(/^Pendiente hace 3 días/).waitFor();
    assert.equal(await follow.locator('time').first().getAttribute('datetime'),today);
    assert.equal(await page.getByText('Seguimiento 2',{exact:true}).count(),0,'Future follow-up is not overdue');
    await page.screenshot({path:path.join(directory,'followup-dates-390.png'),fullPage:true});
    mode.followupDates=['invalid'];await enter();await pager.getByRole('button',{name:'Página 3 de prioridades',exact:true}).click();
    await follow.getByText('Fecha no disponible',{exact:true}).waitFor();
    assert.equal(await follow.getByText(/^Para hoy/).count(),0);
    mode.followupDates=undefined;
    console.log('PASS: follow-up examples show today, overdue age and date; future items stay out and invalid dates remain unavailable.');
    await selectFilter('En espera');await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.waitForURL('**/login');
    assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.startsWith('mateos:workspace:')).length),0);
    const {csrfToken}=await(await context.request.get(origin+'/api/auth/csrf')).json();
    await context.request.post(origin+'/api/auth/callback/credentials',{maxRedirects:0,form:{csrfToken,email:'receptionist@fixture.invalid',password:'fixture-only-password',callbackUrl:origin+'/dashboard',json:'true'}});
    await enter();assert.equal(await page.getByRole('button',{name:'Todas las citas',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(new URL(page.url()).searchParams.get('priorityPage'),'1');
    assert.equal(errors.length,0,errors.join('\n'));assert(!calls.some(call=>call.method!=='GET'));
    await context.close();console.log('PASS: sign-out clears Home preferences and another user starts clean; zero business writes or browser errors.');
  }catch(error){console.error(error.stack);console.error(diagnostics);process.exitCode=1}
  finally{await browser?.close();const exit=once(server,'exit');server.kill();await Promise.race([exit,new Promise(resolve=>setTimeout(resolve,3000))]);await new Promise(resolve=>backend.close(resolve))}
})();


