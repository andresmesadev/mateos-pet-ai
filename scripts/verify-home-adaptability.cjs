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
const directory = path.join(__dirname, '../.cache/home-adaptability');
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
  if (url.pathname.endsWith('/next-actions/upcoming')) return send(mode.empty ? [] : [{ id: 'follow', petId: 'pet-follow', petName: 'Control pendiente', type: mode.modules.includes('veterinary') ? 'control' : 'grooming', dueAt: `${today}T05:00:00Z` }]);
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
    for(const role of ['admin','receptionist','vet','groomer']) {
      const context=await login(role),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      try {
        for(const width of [320,768,1440]) {
          await page.setViewportSize({width,height:1000});await page.goto(origin+'/dashboard?tenant=fixture-selected',{waitUntil:'networkidle'});
          await page.locator('[data-home-section]').first().waitFor();
          const order=await page.locator('[data-home-section]').evaluateAll(nodes=>nodes.map(node=>node.dataset.homeSection));
          assert.deepEqual(order,role==='admin'?['attention','agenda']:['agenda','attention']);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
          if(width===1440) {
            const cols=await page.locator('[data-home-section]').first().evaluate(node=>getComputedStyle(node.parentElement).gridTemplateColumns);
            assert.equal(cols.split(' ').length,2,'Enough content space uses two columns: '+cols);
          }
          const more=page.getByRole('button',{name:'Más accesos',exact:true,includeHidden:true});
          if(await more.count()) {
            const links=page.locator('section[aria-labelledby="quick-actions-heading"] a').filter({hasText:/Consultas veterinarias|Peluquería|Nueva mascota|WhatsApp|Inventario|Reportes/});
            if(width<1024) {
              assert.equal(await more.isVisible(),true);assert.equal(await links.first().isVisible(),false);
              await more.focus();await page.keyboard.press('Enter');
              assert.equal(await more.getAttribute('aria-expanded'),'true');assert.equal(await links.first().isVisible(),true);
              await page.keyboard.press('Space');assert.equal(await links.first().isVisible(),false);
            } else {
              assert.equal(await more.isVisible(),false);
              assert.equal(await links.first().isVisible(),true);
            }
          }
          const card=page.locator('[data-home-section="attention"] > section');
          if(width===1440) await page.waitForFunction(()=>Math.abs(document.querySelector('[data-home-section="attention"] > section').getBoundingClientRect().height-document.querySelector('#home-day-agenda').getBoundingClientRect().height)<2);
          const bound=await card.boundingBox(),footer=page.getByRole('navigation',{name:'Páginas de prioridades'});
          if(await footer.count()){const box=await footer.boundingBox();assert(box.y+box.height<=bound.y+bound.height+1,'Pager stays within card');}
          assert(await card.locator('article[data-home-task]:visible').count()<=3);
          const seen=new Set(),remember=async()=>{for(const id of await card.locator('article[data-home-task]:visible').evaluateAll(nodes=>nodes.map(node=>node.dataset.homeTask)))seen.add(id)};
          await remember();
          if(await footer.count()) {
            const numbers=footer.getByRole('button',{name:/^Página [0-9]+ de prioridades$/});
            for(let i=1;i<await numbers.count();i++){await numbers.nth(i).click();await remember();}
            await numbers.first().click();
          }
          assert.equal(seen.size,await card.locator('article[data-home-task]').count(),'All priorities remain reachable');
          if(width===1440) {
            await page.getByRole('region',{name:'Resumen de la jornada'}).getByRole('button',{name:/^Por llegar:/}).click();
            await page.waitForFunction(()=>Math.abs(document.querySelector('[data-home-section="attention"] > section').getBoundingClientRect().height-document.querySelector('#home-day-agenda').getBoundingClientRect().height)<2);
            assert(await page.getByLabel('Lista de prioridades',{exact:true}).evaluate(node=>node.clientHeight)>=100,'Short agenda keeps priorities readable');
            if(await footer.count()){const box=await footer.boundingBox(),cardBox=await card.boundingBox();assert(box.y+box.height<=cardBox.y+cardBox.height+1);}
            await page.getByRole('button',{name:'Todas las citas',exact:true}).click();
          }
          await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
          await page.screenshot({path:path.join(directory,role+'-'+width+'.png'),fullPage:true});
        }
        console.log('PASS: '+role+' DOM order, permissions and 320/768/1440px layouts.');
        assert.equal(errors.length,0,errors.join('\n'));
      }finally{await context.close()}
    }
    const context=await login('admin'),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/dashboard?tenant=fixture-selected',{waitUntil:'networkidle'});
    const summary=page.getByRole('region',{name:'Resumen de la jornada'}),list=page.getByRole('list',{name:'Citas de la agenda'});
    const originalCounts=await summary.innerText();
    for(const [label,count] of [['Por llegar',0],['En espera',8],['En atención',0],['Terminadas',2]]) {
      const card=summary.getByRole('button',{name:new RegExp('^'+label+':')});await card.click();
      assert.equal(await card.getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#home-day-agenda').evaluate(node=>node===document.activeElement),true);
      assert.equal(await list.locator('li').count(),count);
      assert.equal(await summary.innerText(),originalCounts);
      await page.getByRole('button',{name:'Todas las citas',exact:true}).click();assert.equal(await list.locator('li').count(),8);
    }
    console.log('PASS: four day filters, empty groups, unchanged totals, focus and all-appointments reset.');
    // Simulated time controls browser freshness only; the fixture remains a real read-only HTTP server.
    await page.clock.install({time:new Date()});
    let count=todayCalls();await page.clock.fastForward(130000);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(()=>document.querySelector('button')!==null);await page.waitForTimeout(300);
    await page.clock.runFor(1000);
    assert(todayCalls()>count,'Returning to stale visible page must reread');
    await page.getByRole('button',{name:'Actualizar Inicio',exact:true}).waitFor();
    count=todayCalls();for(let i=0;i<5;i++)await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.clock.runFor(1000);assert.equal(todayCalls(),count);
    console.log('PASS: stale return refreshes reads and rapid focus changes do not duplicate requests.');
    await page.clock.fastForward(31000);
    await page.getByRole('button',{name:/Abrir cita de Mascota espera-/}).first().click();
    await page.getByRole('button',{name:'Cambiar precio',exact:true}).click();await page.locator('#appointment-price').fill('70000');
    count=todayCalls();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.clock.runFor(200);assert.equal(todayCalls(),count);assert.equal(await page.locator('#appointment-price').inputValue(),'70000');
    await page.getByText('Actualización pendiente; se realizará al cerrar la ficha o terminar la edición.',{exact:true}).waitFor();
    await page.keyboard.press('Escape');await page.getByRole('alertdialog').waitFor();await page.getByRole('button',{name:'Descartar cambios',exact:true}).click();
    await page.getByRole('heading',{name:/Cita de Mascota espera-/}).waitFor({state:'hidden'});
    await page.clock.runFor(1000);await page.waitForTimeout(500);
    assert(todayCalls()>count);
    assert(!calls.some(call=>call.method==='POST'||call.method==='PATCH'));
    console.log('PASS: open unsaved price postpones refresh, retains input and refreshes after confirmed close without writes.');
    await page.clock.fastForward(31000);
    await page.evaluate(()=>{window.fixtureHidden=true;Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.fixtureHidden?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'))});
    count=todayCalls();await page.clock.runFor(500);assert.equal(todayCalls(),count);
    await page.evaluate(()=>{window.fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'))});await page.clock.runFor(1000);await page.waitForTimeout(300);assert(todayCalls()>count);
    console.log('PASS: hidden page defers and refreshes when visible.');
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Actualizar Inicio'&&!button.disabled));
    await page.clock.fastForward(31000);await context.setOffline(true);
    await page.getByText('Sin conexión. La consulta se reintentará al regresar.',{exact:true}).waitFor();count=todayCalls();
    await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))});await page.clock.runFor(500);assert.equal(todayCalls(),count);
    await context.setOffline(false);await page.clock.runFor(1000);await page.waitForTimeout(300);
    assert(todayCalls()>count);
    console.log('PASS: offline state blocks reads; connection restoration requests fresh data.');
    // A failed fresh agenda must keep an explicitly stale last result and disable summary cards.
    mode.agendaFail=true;await page.getByRole('button',{name:'Actualizar Inicio',exact:true}).click();await page.clock.runFor(1000);await page.waitForTimeout(300);
    await page.getByText('No se pudo actualizar la jornada. Se muestran las últimas citas cargadas; confirma los datos antes de actuar.',{exact:true}).waitFor();
    assert.equal(await summary.getByRole('button').first().isDisabled(),true);assert.equal(await list.locator('li').count(),8);
    mode.agendaFail=false;await page.getByRole('button',{name:'Actualizar Inicio',exact:true}).click();await page.clock.runFor(1000);await page.waitForTimeout(300);
    assert.equal(await summary.getByRole('button').first().isEnabled(),true);
    console.log('PASS: failed read labels retained agenda, disables unverifiable cards, and successful retry restores them.');
    assert.equal(errors.length,0,errors.join('\n'));await context.close();
    const offlineContext=await login('admin'),offlinePage=await offlineContext.newPage();
    await offlinePage.goto(origin+'/dashboard?tenant=fixture-selected',{waitUntil:'networkidle'});
    await offlinePage.getByRole('button',{name:/Abrir cita de Mascota espera-/}).first().click();
    await offlinePage.getByRole('button',{name:'Cambiar precio',exact:true}).click();
    await offlinePage.locator('#appointment-price').fill('73000');
    await offlineContext.setOffline(true);
    await offlinePage.getByText('Sin conexión. La consulta se reintentará al regresar.',{exact:true}).waitFor();
    await offlinePage.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))});
    await offlinePage.waitForTimeout(400);
    assert.equal(await offlinePage.locator('#appointment-price').inputValue(),'73000');
    await offlineContext.setOffline(false);
    await offlinePage.getByText('Actualización pendiente; se realizará al cerrar la ficha o terminar la edición.',{exact:true}).waitFor();
    assert.equal(await offlinePage.locator('#appointment-price').inputValue(),'73000');
    assert(!calls.some(call=>call.method==='POST'||call.method==='PATCH'));
    console.log('PASS: offline focus and visibility preserve an unsaved form; reconnect defers Home refresh.');
    const accessCalls=calls.filter(call=>call.path==='/access').length;
    mode.accessDeny=true;
    await offlinePage.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await offlinePage.getByText('No se pudieron comprobar tus permisos.',{exact:true}).waitFor();
    assert(calls.filter(call=>call.path==='/access').length>accessCalls);
    assert.equal(await offlinePage.locator('#appointment-price').count(),0);
    mode.accessDeny=false;await offlineContext.close();
    console.log('PASS: online permission revocation blocks the workspace; cached access never overrides rejection.');
    const failedContext=await login('admin'),failedPage=await failedContext.newPage();mode.agendaFail=true;
    await failedPage.goto(origin+'/dashboard?tenant=fixture-selected',{waitUntil:'networkidle'});
    await failedPage.getByRole('heading',{name:'Agenda no disponible',exact:true}).waitFor();
    assert.equal(await failedPage.getByRole('region',{name:'Resumen de la jornada'}).getByRole('button').first().innerText(),'Por llegar\n—');
    assert.equal(await failedPage.getByRole('region',{name:'Resumen de la jornada'}).getByRole('button').first().isDisabled(),true);
    await failedContext.close();console.log('PASS: first failed read shows unavailable values, never a false zero.');
  }catch(error){console.error(error.stack);console.error(diagnostics);process.exitCode=1}
  finally{await browser?.close();const exit=once(server,'exit');server.kill();await Promise.race([exit,new Promise(resolve=>setTimeout(resolve,3000))]);await new Promise(resolve=>backend.close(resolve))}
})();

