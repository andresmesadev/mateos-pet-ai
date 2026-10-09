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
const directory = path.join(__dirname, '../.cache/general-dashboard');
let modules = ['veterinary', 'grooming', 'retail'], calls = [], failRegistration = false, showCases = true, failSearch = false, failSend = false, denyContacts = false, sendGate = null, failedEndpoint = null;
const feedbackMode = process.argv.includes('--feedback-only');
const formsMode = process.argv.includes('--forms-only');
const inventoryFormsMode = process.argv.includes('--inventory-forms-only');
const secondaryFormsMode = process.argv.includes('--secondary-forms-only');
let secondaryGate = null, secondaryFailure = 0;
let inventoryFailure = 0, inventoryGate = null, inventoryPendingStored = true, inventoryFixtures = false;
let failPet = false, malformedClients = false, cashGate = null, registrationGate = null;
let failAppointment = 0, failClientSave = false, failProductSave = 0, productGate = null, showProducts = false;
const inventoryProduct = { id:'product-fixture',name:'Champú de prueba',internalCode:'TEST-01',barcode:'00123',category:'Aseo',presentation:'Frasco de 250 ml',referenceCost:12000,salePrice:18000,stockMinimum:2,lotPolicy:'lot_expiry',uses:['retail','grooming'],metadataVersion:2,priceVersion:1,stockRevision:1,active:true,physical:'3',available:'3',expired:'0',lowStock:false,lots:[] };
const storedOperations = new Map();
const movementFixture = {id:'movement-fixture',operationId:'consumption-fixture',kind:'consumption',quantity:2,stockDelta:-2,balanceAfter:3,occurredAt:new Date().toISOString(),actorName:'Profesional de prueba',reason:'Uso de prueba',lotCodeSnapshot:'LOT-01',presentationSnapshot:'Frasco de 250 ml',entryUnitCost:null};
const returnedSale = {id:'sale-fixture',tenantId:'fixture-selected',userId:null,clientName:'Cliente de prueba',clientPhone:null,petId:null,petName:null,petType:null,appointmentId:null,origin:'manual_pos_sale',status:'voided',voidedAt:new Date().toISOString(),voidReason:'Devolución de prueba',total:54000,paymentMethod:'cash',notes:null,paidAt:new Date().toISOString(),createdAt:new Date().toISOString(),items:[{id:'line-fixture',productId:'product-fixture',description:'Champú de prueba',presentation:'Frasco de 250 ml',quantity:2,unitPrice:18000,total:36000,itemKind:'product',inventoryReturn:null},{id:'line-returned',productId:'product-fixture',description:'Producto ya devuelto',presentation:'Frasco',quantity:1,unitPrice:18000,total:18000,itemKind:'product',inventoryReturn:{id:'return-old',disposition:'restock',quantity:1,recordedAt:new Date().toISOString()}}]};
const secondarySale = { ...returnedSale, id:'secondary-sale', status:'active', voidedAt:null, voidReason:null, items:[returnedSale.items[0]] };
const secondaryCharge = { ...secondarySale, id:'secondary-charge', origin:'system_appointment_completed', appointmentId:'case-veterinary', petName:'Toby', notes:'Nota original', total:66000, items:[{id:'charge-line',description:'Consulta de prueba',quantity:1,unitPrice:66000,total:66000,itemKind:'service'}] };
function cashPage(rows, url) {
  const pending = rows.filter(row => row.origin === 'system_appointment_completed' && !row.recordedBy?.id);
  let filtered = url.searchParams.get('scope') === 'pending' ? pending : rows;
  if (url.searchParams.get('filter') === 'review') filtered = filtered.filter(row => pending.includes(row));
  if (url.searchParams.get('filter') === 'registered') filtered = filtered.filter(row => !pending.includes(row));
  const pageSize = Number(url.searchParams.get('pageSize') || 10), totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)), page = Math.min(Number(url.searchParams.get('page') || 1), totalPages);
  const data = filtered.slice((page - 1) * pageSize, page * pageSize), methods = Object.fromEntries(['cash','transfer','card','other'].map(method => [method, {count:0,cents:0}]));
  let reviewCount = 0, reviewCents = 0, cents = 0;
  for (const row of filtered) { const amount = Math.round(row.total * 100); cents += amount; if (pending.includes(row)) {reviewCount++;reviewCents+=amount;} else {methods[row.paymentMethod].count++;methods[row.paymentMethod].cents+=amount;} }
  return {date:today,scope:url.searchParams.get('scope')||'day',data,transactions:data,toReview:data.filter(row=>pending.includes(row)).map(row=>row.id),total:filtered.length,page,pageSize,totalPages,totalRegistered:cents/100,summary:{activeCount:filtered.length,voidedCount:0,activeTotal:cents/100},summaryCash:{methods,reviewCount,reviewCents},pendingCount:pending.length,hasMore:page<totalPages};
}
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
  calls.push({ path: url.pathname, method: req.method, tenant, requestedTenant: req.headers['x-tenant-id'] || null, role, body, query: url.search, operationKey: req.headers['idempotency-key'] || null });
  if (secondaryFormsMode && req.method === 'POST' && /\/transactions\/secondary-(charge\/settle|sale\/void)$/.test(url.pathname)) {
    if (secondaryGate) await secondaryGate;
    if (secondaryFailure) return send({error:'No se pudo guardar el cambio de prueba.'},secondaryFailure);
    if (url.pathname.endsWith('/settle')) return send({...secondaryCharge,...body,recordedBy:{id:'admin:fixture',name:'Administrador',role:'admin'}});
    Object.assign(secondarySale,{status:'voided',voidReason:body.reason,voidedAt:new Date().toISOString()}); return send(secondarySale);
  }
  if (req.method === 'POST' && /\/(entries|adjustments|corrections|consumptions|inventory-returns)$/.test(url.pathname)) {
    if (inventoryGate) await inventoryGate;
    if (inventoryFailure && inventoryFailure < 500) return send({error:'Las existencias cambiaron. Revisa el movimiento.'},inventoryFailure);
    if (inventoryPendingStored) storedOperations.set(req.headers['idempotency-key'],{id:'movement-created',...body});
    if (inventoryFailure) return send({error:'No se pudo comprobar el movimiento de prueba.'},inventoryFailure);
    return send(storedOperations.get(req.headers['idempotency-key']) || {id:'movement-created',...body},201);
  }
  if (req.method === 'POST' && url.pathname.endsWith('/clients/with-pets')) {
    if (registrationGate) await registrationGate;
    if (failRegistration) return send({ error: 'No se pudo guardar el registro de prueba. Reintenta.' }, 503);
    if (body.phone === 'duplicate') return send({ error: 'Ya existe un cliente con ese teléfono.' }, 409);
    owner = { id: 'owner-created', name: body.name, phone: body.phone, pets: body.pets.map((pet, index) => ({ id: 'pet-created-' + index, name: pet.name, type: pet.type })) };
    return send({ owner: { id: owner.id, name: owner.name, phone: owner.phone }, pets: owner.pets }, 201);
  }
  if (req.method === 'POST' && url.pathname.endsWith('/pets')) {
    if (failPet) return send({ error: 'No se pudo guardar la mascota de prueba. Reintenta.' }, 503);
    const pet = { id: 'pet-added', name: body.name, type: body.type, userId: owner.id }; owner.pets.push(pet); return send(pet, 201);
  }
  if (req.method === 'POST' && url.pathname.endsWith('/appointments')) return failAppointment ? send({error:failAppointment===409?'Este turno acaba de ocuparse. Selecciona otro.':'No se pudo guardar la cita de prueba.'},failAppointment) : send({ id: 'appointment-created', ...body }, 201);
  if (req.method === 'PATCH' && /\/clients\/[^/]+$/.test(url.pathname)) {
    if (failClientSave) return send({error:'No se pudo actualizar el cliente de prueba.'},503);
    owner = {...owner,...body}; return send(body);
  }
  if (['POST','PATCH'].includes(req.method) && /\/inventory\/products(?:\/[^/]+)?$/.test(url.pathname)) {
    if (productGate) await productGate;
    if (failProductSave === 400) return send({error:'Ese código interno ya existe.'},400);
    storedOperations.set(req.headers['idempotency-key'],{id:'product-created',...body});
    if (failProductSave) return send({error:'No se pudo comprobar el resultado de prueba.'},failProductSave);
    return send(storedOperations.get(req.headers['idempotency-key']),201);
  }
  if (req.method === 'DELETE') return send({ error: 'Deletion deliberately rejected in fixture' }, 409);
  if (req.method === 'POST' && url.pathname.endsWith('/send')) { if (sendGate) await sendGate; return send(failSend ? {error:'Prueba de fallo de envío'} : {message:{id:'sent-fixture',role:'assistant',origin:'manual',content:body.message,createdAt:new Date().toISOString()}}, failSend ? 503 : 200); }
  if (req.method !== 'GET') return send({ error: 'Unsupported fixture operation' }, 405);
  if (secondaryFormsMode && url.pathname.endsWith('/transactions/secondary-sale')) return send(secondarySale);
  if (secondaryFormsMode && url.pathname.endsWith('/transactions/secondary-charge')) return send(secondaryCharge);
  if (secondaryFormsMode && url.pathname.endsWith('/transactions')) return send({data:[secondarySale],total:1,page:1,pageSize:25,totalPages:1,summary:{activeCount:secondarySale.status==='active'?1:0,voidedCount:secondarySale.status==='voided'?1:0,activeTotal:secondarySale.status==='active'?secondarySale.total:0}});
  if (secondaryFormsMode && url.pathname.endsWith('/cash/operational')) return send(cashPage([secondaryCharge],url));
  if (failedEndpoint && url.pathname.endsWith(failedEndpoint)) return send({error:'Fallo de conexión de prueba'},503);
  if (url.pathname.endsWith('/opportunities')) return send({byType:{},total:0,page:1,totalPages:1,pageSize:25,periodCounts:{all:0,past:0,today:0,next7:0}});
  if (url.pathname.endsWith('/clients/inactive')) return send({data:[],total:0,page:1,totalPages:1,pageSize:25});
  if (url.pathname.endsWith('/metrics/recovery')) return send({reactivation:{contacted:0,reactivated:0,rate:0},nextActions:{reminded:0,closed:0,rate:0}});
  if (url.pathname.endsWith('/cash/context')) { if (cashGate) await cashGate; return send({draftScope:'fixture-only-draft'}); }
  if (url.pathname.endsWith('/cash/catalog')) return send(services.map(x=>({...x,price:x.basePrice,priceSource:'base'})));
  if (url.pathname.endsWith('/inventory/context')) return send({scope:'fixture-only-inventory'});
  if (/\/inventory\/products\/[^/]+\/movements$/.test(url.pathname)) return send({data:inventoryFixtures?[movementFixture]:[],nextCursor:null});
  if (/\/inventory\/operations\/[^/]+$/.test(url.pathname)) return storedOperations.has(url.pathname.split('/').pop()) ? send(storedOperations.get(url.pathname.split('/').pop())) : send({error:'Sin resultado'},404);
  if (inventoryFixtures && /\/transactions\/sale-fixture$/.test(url.pathname)) return send(returnedSale);
  if (url.pathname.endsWith('/transactions') || url.pathname.endsWith('/expenses')) return send({data:inventoryFixtures&&url.pathname.endsWith('/transactions')?[returnedSale]:[],total:inventoryFixtures?1:0,page:1,pageSize:Number(url.searchParams.get('pageSize')||10),totalPages:1,summary:{activeCount:0,voidedCount:inventoryFixtures?1:0,activeTotal:0}});
  if (url.pathname.includes('/reports/')) {
    const metadata=require('../backend/src/routes/dashboard/report-period').readReportPeriod(Object.fromEntries(url.searchParams)).metadata;
    const point={value:0,prev:0,delta:0,pct:null};
    if(url.pathname.endsWith('/summary')) return send({...metadata,establishment:{id:tenant,name:'Centro de prueba'},revenue:point,expenses:point,difference:point,appointments:point,newClients:point,petsAttended:point,transactionCount:0});
    if(url.pathname.endsWith('/breakdown'))return send({...metadata,total:0,count:0,byMethod:['cash','transfer','card','other','review','unclassified'].map(method=>({method,count:0,total:0})),byKind:['product','service','unclassified'].map(kind=>({kind,quantity:0,lines:0,total:0})),unallocatedTotal:0});
    if(url.pathname.endsWith('/revenue-by-month'))return send(Array.from({length:12},(_,i)=>({month:i+1,revenue:0,year:Number(url.searchParams.get('year')||metadata.year)})));
    if(url.pathname.endsWith('/clients-retention'))return send(Array.from({length:6},(_,i)=>({label:'Mes '+(i+1),newClients:0,returningVisits:0})));
    return send([]);
  }
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
    if (malformedClients) return send({ data: [null], total: 1 });
    const item = { ...owner, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { pets: owner.pets.length, appointments: 0, conversations: 0 } };
    return send(url.searchParams.has('page') ? { data: [item], total: 1, totalPages: 1 } : [item]);
  }
  if (url.pathname.endsWith('/pets')) return send({ data: [], total: 0 });
  if (url.pathname.endsWith('/grooming/appointments')) return send({ appointments: visits(role).filter(visit => visit.serviceCategory === 'grooming'), hasMore: false });
  if (url.pathname.endsWith('/conversations')) return send({ data: [{id:'chat-fixture',userId:owner.id,tenantId:tenant,name:owner.name,phone:owner.phone,status:'en_atencion_humana',updatedAt:new Date().toISOString(),lastMessageAt:new Date().toISOString(),requires_human_attention:true,controlVersion:1}], pagination: {page:1,limit:25,total:1,totalPages:1} });
  if (url.pathname.endsWith('/conversations/owner-existing/messages')) return send({conversation:{id:'chat-fixture',userId:owner.id,tenantId:tenant,name:owner.name,phone:owner.phone,status:'en_atencion_humana',assignment:{actorId:'admin',name:'Prueba',role:'admin',since:new Date().toISOString()},controlVersion:1,updatedAt:new Date().toISOString(),requires_human_attention:true},messages:[],viewer:{role,isMine:true,canRelease:true,canTakeOver:true,canCreateAppointment:true}});
  if (url.pathname.endsWith('/cash/operational')) return send(cashPage([],url));
  if (url.pathname.endsWith('/inventory/products')) return send({ data: showProducts ? [inventoryProduct] : [], nextCursor: null });
  if (url.pathname.endsWith('/metrics/cashbox')) return send({date:today,totalIncome:0,totalExpenses:0,netBalance:0,transactionCount:0,expenseCount:0,incomeByMethod:[],expensesByCategory:[],transactions:[],expenses:[]});
  return send([]);
});



(async()=>{
 fs.mkdirSync(directory,{recursive:true});
 await new Promise((resolve,reject)=>{backend.once('error',reject);backend.listen(3030,'127.0.0.1',resolve)});
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3031'],{cwd:path.join(__dirname,'../frontend'),env:{...process.env,NEXT_VERIFY_BUILD:'1',API_URL:'http://127.0.0.1:3030',NEXTAUTH_URL:origin,NEXTAUTH_SECRET:'fixture-only-secret',AUTH_TRUST_HOST:'true',INTERNAL_API_SECRET:'fixture-only-token',ADMIN_EMAIL:'admin@fixture.invalid',ADMIN_PASSWORD:'fixture-only-password'},stdio:['ignore','pipe','pipe']});
 let diagnostics='',browser;server.stdout.on('data',x=>diagnostics=(diagnostics+x).slice(-1800));server.stderr.on('data',x=>diagnostics=(diagnostics+x).slice(-1800));
 const errors=[];
 const login=async(role,width,{height=1000,deviceScaleFactor=1}={})=>{
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor});
  const {csrfToken}=await(await context.request.get(origin+'/api/auth/csrf')).json();
  await context.request.post(origin+'/api/auth/callback/credentials',{maxRedirects:0,form:{csrfToken,email:role+'@fixture.invalid',password:'fixture-only-password',callbackUrl:origin+'/dashboard',json:'true'}});
  assert.equal((await(await context.request.get(origin+'/api/auth/session')).json()).user.role,role);
  const page=await context.newPage();page.on('pageerror',x=>errors.push(x.stack || x.message));return{context,page};
 };
 const go=async(page,route)=>{
  const response=await page.goto(origin+'/dashboard/'+route+(route.includes('?')?'&':'?')+'tenant=fixture-selected',{waitUntil:'networkidle'});
  assert(response.status()<500,'HTTP failure at '+route);
  await page.waitForTimeout(100);
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert(overflow.scroll<=overflow.width+1,JSON.stringify({route,...overflow}));
  assert.equal(errors.length,0,route+'\n'+errors.join('\n'));
 };
 try{
  for(let i=0;i<60;i++){try{if((await fetch(origin+'/login')).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
  browser=await chromium.launch({channel:'chrome',headless:true});
  if (feedbackMode || formsMode || inventoryFormsMode || secondaryFormsMode) {
    const controls = {
      registration: value => { failRegistration = value; }, pet: value => { failPet = value; },
      corrupt: value => { malformedClients = value; }, endpoint: value => { failedEndpoint = value; },
      cashGate: value => { cashGate = value; }, registrationGate: value => { registrationGate = value; },
      appointment: value => { failAppointment = value; }, client: value => { failClientSave = value; },
      product: value => { failProductSave = value; }, productGate: value => { productGate = value; }, products: value => { showProducts = value; },
      foreignOperation: value => { storedOperations.set(value.key, {id:'foreign-fixture',...JSON.parse(value.body)}); },
      inventory: value => { inventoryFailure = value; }, inventoryGate: value => { inventoryGate = value; }, pendingStored: value => { inventoryPendingStored = value; },
      inventoryName: value => { inventoryProduct.name = value; },
      inventoryFixtures: () => { inventoryFixtures = true; showProducts = true; inventoryProduct.uses = ['retail','veterinary','grooming']; inventoryProduct.lots = [{id:'lot-fixture',lotCode:'LOT-01',physical:3,available:3,expiresOn:'2030-01-01',expiresSoon:false}]; },
      secondaryGate: value => { secondaryGate = value; }, secondaryFailure: value => { secondaryFailure = value; },
      resetSecondary: () => { Object.assign(secondarySale,{status:'active',voidedAt:null,voidReason:null}); },
      emptyProduct: active => { showProducts = true; inventoryProduct.lots = []; inventoryProduct.active = active; },
    };
    if (formsMode) { await require('./verify-frontend-form-layout.cjs')({login,origin,errors,directory,calls,control:controls}); return; }
    if (inventoryFormsMode) { await require('./verify-inventory-form-layout.cjs')({login,origin,errors,directory,calls,control:controls}); return; }
    if (secondaryFormsMode) { await require('./verify-secondary-form-layout.cjs')({login,origin,errors,directory,calls,control:controls}); return; }
    await require('./verify-frontend-feedback.cjs')({ browser, login, origin, errors, directory, calls, control: {
      ...controls,
    } });
    return;
  }
  const {context,page}=await login('admin',1440);
  const allRoutes=['calendar','consultas','peluqueria','contacto','conversations','inventory','recuperacion','pos?tab=venta','pos?tab=caja','pos?tab=egreso','pos?tab=historial','pos?tab=reportes','settings?tab=general','settings?tab=areas','settings?tab=localizacion','settings?tab=agenda','settings?tab=usuarios'];
  const routes=process.argv.includes('--reports-only')?['pos?tab=reportes']:allRoutes;
  for(const width of [320,768,1440]){
   await page.setViewportSize({width,height:1000});
   for(const route of routes){
    await go(page,route);
    if(route==='pos?tab=reportes') {
      await page.getByText('Resumen del período',{exact:true}).waitFor();
      const reportAlerts=await page.locator('main section[aria-label]').getByRole('alert').allTextContents();
      assert.deepEqual(reportAlerts,[],JSON.stringify(reportAlerts));
    }
    if(['pos?tab=venta','pos?tab=reportes','settings?tab=usuarios','contacto'].includes(route))await page.screenshot({path:path.join(directory,width+'-'+route.replace(/[^a-z0-9]/g,'-')+'.png'),fullPage:true});
   }
   console.log('PASS: '+routes.length+' module/section screens at '+width+' px, no horizontal overflow, HTTP 500 or browser runtime errors.');
  }
  // Server enforces the finance capability even for explicit report entries.
  await context.close();
  for(const role of ['receptionist','vet','groomer']){
   const{context,page}=await login(role,768);const c=effectiveAccess({type:role,staffId:role},modules).capabilities;
   await go(page,'contacto');
   if(c.clinical)await go(page,'consultas');
   if(c.grooming)await go(page,'peluqueria');
   await go(page,'conversations');
   if(c.inventory_read)await go(page,'inventory');
   if(c.cash){
    await go(page,'pos?tab=reportes');
    const nav=page.getByRole('navigation',{name:'Secciones del punto de venta'});
    assert.equal(await nav.getByRole('link',{name:'Reportes',exact:true}).count(),0);
    assert.equal(await nav.getByRole('link',{name:'Gastos',exact:true}).count(),0);
    assert.equal(await nav.getByRole('link',{name:'Historial de cobros',exact:true}).count(),0);
    await go(page,'pos?tab=caja');assert.equal(await page.getByRole('heading',{name:'Resumen administrativo',exact:true}).count(),0);
   }
   console.log('PASS: '+role+' available screens and finance privacy follow authenticated capabilities.');
   await context.close();
  }
  const recovery=await login('admin',390);
  failedEndpoint='/cash/operational';await go(recovery.page,'pos?tab=caja');
  await recovery.page.getByRole('alert').filter({hasText:'No se pudieron cargar los cobros'}).waitFor();
  failedEndpoint=null;await recovery.page.getByRole('button',{name:'Actualizar',exact:true}).first().click();
  await recovery.page.getByText('No se pudieron cargar los cobros. Intenta de nuevo.',{exact:true}).waitFor({state:'hidden'});
  console.log('PASS: cash failure is explicit and retry restores the screen, with no business writes.');
  await recovery.context.close();
  assert(calls.every(call=>call.method==='GET'),'Unexpected business write');
  // Admin sign-in may resolve the initial /dashboard manifest before selecting
  // an establishment. Every business-data read must use the effective tenant.
  const bootstrap=calls.filter(call=>call.role==='admin'&&call.path==='/api/dashboard/access'&&call.requestedTenant===null&&call.query==='');
  assert(bootstrap.length<=2,'Only the two administrator sign-ins may bootstrap without a selected tenant');
  const wrongTenant=calls.filter(call=>!bootstrap.includes(call)&&call.tenant!==(call.role==='admin'?'fixture-selected':'fixture-tenant'));
  assert.equal(wrongTenant.length,0,JSON.stringify(wrongTenant));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: zero business writes, zero external messages and all business-data reads tenant-scoped.');
 }catch(error){console.error(error.stack);console.error(diagnostics);process.exitCode=1}
 finally{await browser?.close();const stopped=once(server,'exit');server.kill();await Promise.race([stopped,new Promise(r=>setTimeout(r,3000))]);await new Promise(r=>backend.close(r))}
})();

