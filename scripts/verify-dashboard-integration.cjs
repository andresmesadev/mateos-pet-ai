// Real Next proxy, authentication, Express routes and PostgreSQL in a disposable DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname,'..');
require(path.join(root,'backend/node_modules/dotenv')).config({path:path.join(root,'backend/.env'),quiet:true});
const original = new URL(process.env.DATABASE_URL);
assert(['localhost','127.0.0.1'].includes(original.hostname)&&original.pathname==='/mateos_dev','Local database required');
const { Client } = require(path.join(root,'backend/node_modules/pg'));
const { chromium } = require('playwright');
const name='mateos_dashboard_check_'+randomBytes(6).toString('hex');
const testUrl=new URL(original);testUrl.pathname='/'+name;
const admin=new Client({connectionString:original.toString()});
const origin='http://localhost:3031', secret=randomBytes(24).toString('hex');
const password='isolated-check-password', tenantId='integration-a';
let created=false,prisma,pool,backend,server,browser,passed=0;
const errors=[];
const check = label => {passed++;console.log('PASS '+label);};
async function main() {
  await admin.connect();
  try {
    await admin.query('CREATE DATABASE "'+name+'"');created=true;
    const setup=new Client({connectionString:testUrl.toString()});await setup.connect();
    try {await setup.query('CREATE EXTENSION IF NOT EXISTS vector');}finally{await setup.end();}
    const migrated=spawnSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:testUrl.toString()},encoding:'utf8',timeout:120000});
    assert.equal(migrated.status,0,'Migration of disposable database failed');
    process.env.DATABASE_URL=testUrl.toString();process.env.NODE_ENV='development';process.env.SINGLE_TENANT_ID='';process.env.INTERNAL_API_SECRET=secret;
    // Explicit pool ownership allows deterministic shutdown before DROP DATABASE.
    const {Pool}=require(path.join(root,'backend/node_modules/pg'));
    const {PrismaClient}=require(path.join(root,'node_modules/@prisma/client'));
    const {PrismaPg}=require(path.join(root,'backend/node_modules/@prisma/adapter-pg'));
    pool=new Pool({connectionString:testUrl.toString()});
    prisma=new PrismaClient({adapter:new PrismaPg(pool,{disposeExternalPool:true})});
    const prismaPath=require.resolve('../backend/src/lib/prisma');
    require.cache[prismaPath]={id:prismaPath,filename:prismaPath,loaded:true,exports:prisma};
    await prisma.eventType.createMany({data:['CobroLiquidado','VentaAnulada'].map(name=>({name,originContext:'finance',active:true}))});
    const {hashPassword}=require('../backend/src/services/staff-credential.service');
    const hashed=await hashPassword(password);
    for(const id of [tenantId,'integration-b'])await prisma.tenant.create({data:{id,name:'Establecimiento de prueba '+id,slug:id,phone:id,activeModules:['veterinary','grooming','retail']}});
    for(const role of ['admin','receptionist','vet','groomer'])await prisma.staff.create({data:{id:'staff-'+role,tenantId,name:role+' de prueba',role,accessPermissions:['vet','groomer'].includes(role)?['inventory_consume']:[],credential:{create:{email:role+'@integration.invalid',passwordHash:hashed}}}});
    const owner=await prisma.user.create({data:{tenantId,name:'Propietario de prueba',phone:'000000000000'}});
    const pet=await prisma.pet.create({data:{tenantId,ownerId:owner.id,name:'Paciente de prueba',type:'dog'}});
    const appointments={};
    for(const [area,role] of [['veterinary','vet'],['grooming','groomer']]) {
      const category=await prisma.serviceCategory.create({data:{tenantId,name:area,appliesCommissionSplit:area==='grooming'}});
      const service=await prisma.service.create({data:{tenantId,categoryId:category.id,name:'Servicio de prueba '+area,duration:30,basePrice:66000}});
      appointments[role]=await prisma.appointment.create({data:{tenantId,petId:pet.id,userId:owner.id,petName:pet.name,petType:pet.type,serviceId:service.id,serviceType:area,staffId:'staff-'+role,status:'in_progress',date:new Date(),startedAt:new Date()}});
    }
    const charge=await prisma.transaction.create({data:{tenantId,userId:owner.id,petId:pet.id,appointmentId:appointments.vet.id,total:66000,paymentMethod:'cash',origin:'system_appointment_completed',items:{create:{description:'Consulta de prueba',quantity:1,unitPrice:66000,total:66000,itemKind:'service'}}}});
    const express=require('../backend/node_modules/express');const app=express();app.use(express.json());
    app.use('/api/internal',require('../backend/src/middleware/requireInternalToken').requireInternalToken,require('../backend/src/routes/staff-auth.routes'));
    app.use('/api/dashboard',require('../backend/src/middleware/resolveTenant').resolveTenant,require('../backend/src/routes/dashboard.routes'));
    app.use((error,req,res,next)=>{console.error('Integration adapter error:',error.name);res.status(500).json({error:'Test adapter failed'});});
    backend=await new Promise((resolve,reject)=>{const x=app.listen(3030,'127.0.0.1',()=>resolve(x));x.once('error',reject);});
    server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3031'],{cwd:path.join(root,'frontend'),env:{...process.env,NODE_ENV:'production',NEXT_VERIFY_BUILD:'1',API_URL:'http://127.0.0.1:3030',NEXTAUTH_URL:origin,NEXTAUTH_SECRET:secret,AUTH_TRUST_HOST:'true',ADMIN_EMAIL:'super@integration.invalid',ADMIN_PASSWORD:password,INTERNAL_API_SECRET:secret,SINGLE_TENANT_ID:''},stdio:['ignore','pipe','pipe']});
    let diagnostics='';server.stdout.on('data',()=>{});server.stderr.on('data',x=>diagnostics=(diagnostics+x).slice(-1500));
    let ready=false;for(let i=0;i<60;i++){try{if((await fetch(origin+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert(ready,'Verification frontend did not start');
    browser=await chromium.launch({channel:'chrome',headless:true});
    const sessions={};
    async function login(role) {
      const context=await browser.newContext({viewport:{width:768,height:900}});
      const {csrfToken}=await(await context.request.get(origin+'/api/auth/csrf')).json();
      await context.request.post(origin+'/api/auth/callback/credentials',{maxRedirects:0,form:{csrfToken,email:role+'@integration.invalid',password,callbackUrl:origin+'/dashboard',json:'true'}});
      const session=await(await context.request.get(origin+'/api/auth/session')).json();assert.equal(session.user.role,role);
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};
    }
    for(const role of ['admin','receptionist','vet','groomer'])sessions[role]=await login(role);
    sessions.second=await login('admin');
    async function api(role,route,{method='GET',body,key=randomUUID(),status=200}={}) {
      const response=await sessions[role].context.request.fetch(origin+'/api/proxy/dashboard'+route,{method,headers:{'Content-Type':'application/json','Idempotency-Key':key},...(body!==undefined?{data:body}:{})});
      const value=await response.json();assert.equal(response.status(),status,`${role} ${route}: ${value.error||'Unexpected response status'}`);return value;
    }
    const product=(await api('admin','/inventory/products',{method:'POST',body:{name:'Producto de integración',category:'Aseo',internalCode:'INTEGRATION-01',presentation:'Frasco',uses:['retail','veterinary','grooming'],referenceCost:'500',salePrice:'1000',stockMinimum:2,lotPolicy:'untracked'}})).product;
    await api('admin',`/inventory/products/${product.id}/entries`,{method:'POST',body:{quantity:10,unitCost:'500'}});
    const detail = role => api(role,`/inventory/products/${product.id}`);
    async function visibleStock(role,expected) {
      const page=sessions[role].page;await page.goto(origin+'/dashboard/inventory',{waitUntil:'networkidle'});
      const card=page.locator('[data-inventory-cards] > li').filter({hasText:'Producto de integración'});
      await card.waitFor();assert.equal(await card.locator('dd').first().textContent(),String(expected));
    }
    await visibleStock('admin',10);await visibleStock('second',10);
    check('Real authentication and proxy show the same initial PostgreSQL stock in two sessions');
    const sale=await api('receptionist','/transactions',{method:'POST',status:201,body:{paymentMethod:'cash',items:[{productId:product.id,itemKind:'product',description:product.name,quantity:2,unitPrice:1000,priceVersion:product.priceVersion}]}});
    assert.equal((await detail('admin')).available,'8');await visibleStock('admin',8);await visibleStock('second',8);
    check('Reception sells a catalogue product; stock and both refreshed screens agree');
    for(const role of ['vet','groomer']) {
      await api(role,'/inventory/consumptions',{method:'POST',body:{area:role==='vet'?'veterinary':'grooming',appointmentId:appointments[role].id,items:[{productId:product.id,quantity:1}]}});
      const p=await detail(role);assert(!('referenceCost' in p));assert(!('salePrice' in p));
      await api(role,`/inventory/products/${product.id}/entries`,{method:'POST',body:{quantity:1,unitCost:'500'},status:403});
      await api(role,'/transactions',{method:'POST',body:{paymentMethod:'cash',items:[]},status:403});
    }
    assert.equal((await detail('admin')).available,'6');
    check('Veterinarian and groomer consume only through their permissions without seeing costs or receiving cash access');
    for(const role of ['receptionist','vet','groomer'])await api(role,`/transactions/${sale.id}/void`,{method:'POST',body:{reason:'Denied test'},status:403});
    const reception=sessions.receptionist.page;await reception.goto(origin+'/dashboard/pos?tab=caja',{waitUntil:'networkidle'});
    await reception.getByRole('button',{name:'Revisar pago',exact:true}).click();
    await reception.getByRole('button',{name:'Recibí el valor exacto',exact:true}).click();
    await reception.getByRole('button',{name:'Confirmar método de pago',exact:true}).click();
    await reception.getByRole('dialog').waitFor({state:'hidden'});
    const settled=await prisma.transaction.findUnique({where:{id:charge.id}});assert.equal(settled.recordedActorId,'staff:staff-receptionist');assert.equal(Number(settled.total),66000);
    assert.equal(await prisma.transaction.count({where:{appointmentId:appointments.vet.id}}),1);
    check('Reception confirms the real service charge through the new form without changing the amount or duplicating it');
    const adminPage=sessions.admin.page;await adminPage.goto(origin+'/dashboard/pos?tab=historial',{waitUntil:'networkidle'});
    await adminPage.getByRole('button',{name:'Anular',exact:true}).click();await adminPage.locator('#sale-void-reason').fill('Verificación aislada de anulación');
    await adminPage.getByRole('button',{name:'Confirmar anulación',exact:true}).click();await adminPage.getByRole('heading',{name:'Venta anulada',exact:true}).waitFor();
    assert.equal((await detail('admin')).available,'6');
    const voided=await prisma.transaction.findUnique({where:{id:sale.id}});assert.equal(voided.status,'voided');assert.equal(Number(voided.total),2000);
    await adminPage.getByRole('dialog').locator('[data-slot="dialog-footer"]').getByRole('button',{name:'Cerrar',exact:true}).click();
    const returnKey=randomUUID(),returnBody={reason:'Mercancía recibida en prueba',items:[{transactionItemId:sale.items[0].id,disposition:'restock'}]};
    await api('admin',`/transactions/${sale.id}/inventory-returns`,{method:'POST',body:returnBody,key:returnKey});
    await api('admin',`/transactions/${sale.id}/inventory-returns`,{method:'POST',body:returnBody,key:returnKey});
    assert.equal((await detail('admin')).available,'8');await visibleStock('second',8);
    check('Only admin cancels; cancellation preserves stock and amount; idempotent return restores two units once');
    assert.equal(await prisma.domainEvent.count({where:{eventType:{name:{in:['CobroLiquidado','VentaAnulada']}}}}),2);
    // More than the old 200-row limit, including a real appointment charge from yesterday.
    const today = new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'});
    const yesterday = new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
    const oldAppointment = await prisma.appointment.create({data:{tenantId,userId:owner.id,petId:pet.id,petName:pet.name,petType:pet.type,serviceType:'vet',staffId:'staff-vet',status:'completed',date:new Date(yesterday+'T10:00:00-05:00')}});
    const oldCharge = await prisma.transaction.create({data:{tenantId,userId:owner.id,petId:pet.id,appointmentId:oldAppointment.id,origin:'system_appointment_completed',total:70000,paymentMethod:'cash',paidAt:new Date(yesterday+'T10:30:00-05:00'),items:{create:{description:'Consulta del día anterior',itemKind:'service',quantity:1,unitPrice:70000,total:70000}}}});
    await prisma.transaction.createMany({data:Array.from({length:201},(_,i)=>({id:'pagination-charge-'+String(i).padStart(3,'0'),tenantId,origin:'system_appointment_completed',total:100,paymentMethod:'cash',paidAt:new Date(today+'T09:00:00-05:00')}))});
    const first = await api('receptionist','/cash/operational?scope=pending&pageSize=10');
    assert.equal(first.total,202); assert.equal(first.pendingCount,202); assert.equal(first.data.length,10); assert.equal(first.totalRegistered,90100); assert.equal(first.summaryCash.reviewCount,202);
    const last = await api('receptionist','/cash/operational?scope=pending&pageSize=10&page=21');
    assert.equal(last.totalPages,21); assert(last.data.some(row=>row.id===oldCharge.id)); assert.equal(last.totalRegistered,first.totalRegistered);
    await api('receptionist','/cash/operational?scope=day&date='+yesterday,{status:403});
    await api('admin','/cash/operational?scope=day&date='+yesterday);
    await api('admin','/cash/operational?scope=pending&pageSize=51',{status:400});
    await api('admin','/cash/operational?scope=pending&scope=day',{status:400});
    await api('receptionist','/metrics/cashbox',{status:403});
    check('202 pending charges are paginated with complete totals; reception finds yesterday without gaining historical reports');
    const closeSnapshot=await prisma.dailyClose.create({data:{tenantId,date:new Date(yesterday+'T00:00:00-05:00'),incomeTotal:70000,expenseTotal:0,netAmount:70000,staffBreakdown:[]}});
    await reception.goto(origin+'/dashboard/pos?tab=caja&review=1',{waitUntil:'networkidle'});
    await reception.getByLabel('Buscar un movimiento',{exact:true}).fill('Consulta del día anterior');
    await reception.getByRole('button',{name:'Revisar pago',exact:true}).click();
    await reception.getByRole('button',{name:'Recibí el valor exacto',exact:true}).click();
    await reception.getByRole('button',{name:'Confirmar método de pago',exact:true}).click();
    await reception.getByRole('dialog').waitFor({state:'hidden'});
    const reviewedOld=await api('receptionist',`/transactions/${oldCharge.id}`);
    assert.equal(reviewedOld.recordedBy.id,'staff:staff-receptionist'); assert.equal(reviewedOld.total,70000);
    assert.deepEqual(await prisma.dailyClose.findUnique({where:{id:closeSnapshot.id}}),closeSnapshot);
    assert.equal(await prisma.transaction.count({where:{appointmentId:oldAppointment.id}}),1);
    check('Reception reviews an old service through the real form; original income and the frozen daily close remain identical');

    const {effectiveAccess}=require('../backend/src/services/dashboard-access.service');
    const combinations=[['veterinary'],['grooming'],['retail'],['veterinary','grooming'],['veterinary','retail'],['grooming','retail'],['veterinary','grooming','retail']];
    let matrixRequests=0;
    for(const activeModules of combinations) {
      await prisma.tenant.update({where:{id:tenantId},data:{activeModules}});
      for(const role of ['admin','receptionist','vet','groomer']) {
        const expected=effectiveAccess({type:role,staffId:'staff-'+role,accessPermissions:['vet','groomer'].includes(role)?['inventory_consume']:[]},activeModules);
        const actual=await api(role,'/access'); assert.deepEqual(actual.capabilities,expected.capabilities);
        for(const [route,allowed] of [['/cash/operational',expected.capabilities.cash],['/inventory/context',expected.capabilities.inventory_read],[`/pets/${pet.id}/records`,role==='admin'||expected.capabilities.clinical],[`/grooming/pets/${pet.id}/notes`,role==='admin'||expected.capabilities.grooming],['/metrics/cashbox',role==='admin']]) {
          await api(role,route,{status:allowed?200:403}); matrixRequests++;
        }
      }
    }
    await prisma.tenant.update({where:{id:tenantId},data:{activeModules:['veterinary','grooming','retail']}});
    check(`Real HTTP permission matrix: 4 roles × 7 module combinations, ${matrixRequests} protected reads`);
    await prisma.staff.update({where:{id:'staff-vet'},data:{accessPermissions:['cash','inventory_consume']}});
    const vetPage=sessions.vet.page; await vetPage.goto(origin+'/dashboard/pos?tab=caja&review=1',{waitUntil:'networkidle'});
    await vetPage.getByRole('button',{name:'Revisar pago',exact:true}).first().click();
    await vetPage.getByRole('button',{name:'Recibí el valor exacto',exact:true}).click();
    await prisma.staff.update({where:{id:'staff-vet'},data:{accessPermissions:['inventory_consume']}});
    const countBefore=await prisma.domainEvent.count({where:{eventType:{name:'CobroLiquidado'}}});
    await vetPage.getByRole('button',{name:'Confirmar método de pago',exact:true}).click();
    await vetPage.getByRole('dialog').getByRole('alert').waitFor();
    assert.equal(await prisma.domainEvent.count({where:{eventType:{name:'CobroLiquidado'}}}),countBefore);
    assert.equal(await vetPage.locator('#payment-received').inputValue(),'100');
    check('Cash permission removed while a form is open blocks the operation server-side and retains the entered value');
    const oldManual=await prisma.transaction.create({data:{tenantId,origin:'manual_sale',total:300,paymentMethod:'cash',paidAt:new Date(yesterday+'T11:00:00-05:00')}});
    await api('receptionist',`/transactions/${oldManual.id}`,{status:404});
    await api('admin',`/transactions/${oldManual.id}`);
    const foreignCharge=await prisma.transaction.create({data:{tenantId:'integration-b',origin:'system_appointment_completed',total:999,paymentMethod:'cash',paidAt:new Date(yesterday+'T10:00:00-05:00')}});
    await api('receptionist',`/transactions/${foreignCharge.id}`,{status:404});
    await api('admin',`/transactions/${foreignCharge.id}`,{status:404});
    const ownPending=await api('receptionist','/cash/operational?scope=pending&tenantId=integration-b');
    assert.equal(ownPending.total,201); assert.equal(ownPending.totalRegistered,20100);
    const foreign=await prisma.inventoryProduct.create({data:{tenantId:'integration-b',name:'Foreign product',category:'Aseo',internalCode:'FOREIGN',internalCodeKey:'foreign',presentation:'Frasco',uses:['retail'],lotPolicy:'untracked',referenceCost:500,salePrice:1000}});
    await api('admin',`/inventory/products/${foreign.id}`,{status:404});
    await api('admin',`/inventory/products/${foreign.id}/entries`,{method:'POST',body:{quantity:1,unitCost:'500'},status:404});
    await api('admin',`/inventory/products/${product.id}/entries`,{method:'POST',body:{quantity:1,unitCost:'500',tenantId:'integration-b'},status:400});
    const hijack=await sessions.receptionist.context.request.get(origin+'/api/proxy/dashboard/inventory/products?tenant=integration-b');assert.equal(hijack.status(),200);
    const scoped=(await hijack.json()).data;assert(scoped.some(p=>p.id===product.id));assert(scoped.every(p=>p.id!==foreign.id));
    const forged=await fetch('http://127.0.0.1:3030/api/dashboard/inventory/products',{headers:{'x-internal-token':secret,'x-tenant-id':'integration-b','x-staff-id':'staff-receptionist','x-staff-session-version':'1'}});assert.equal(forged.status,403);
    const unauthenticated=await fetch('http://127.0.0.1:3030/api/dashboard/inventory/products');assert.equal(unauthenticated.status,401);
    assert.equal(await prisma.inventoryMovement.count({where:{tenantId:'integration-b'}}),0);
    check('Cross-tenant IDs/body/forged identity are rejected; query cannot override the authenticated tenant; missing authentication rejected');
    assert.equal(errors.length,0,errors.join('\n'));assert(!/Error:|Unhandled/.test(diagnostics),diagnostics);
    check('Frontend, authenticated proxy, real Express routes and PostgreSQL completed without browser errors');
    console.log(`Integration checks: ${passed} passed, 0 failed. Disposable database only; no jobs or outgoing messages.`);
  } finally {
    await browser?.close();
    if(server&&server.exitCode===null){await new Promise(resolve=>{server.once('exit',resolve);server.kill();setTimeout(resolve,3000);});}
    if(backend)await new Promise(resolve=>backend.close(resolve));
    await prisma?.$disconnect();
    if(pool&&!pool.ending) await pool.end();
    if(created){assert(/^mateos_dashboard_check_[a-f0-9]{12}$/.test(name));await admin.query('DROP DATABASE "'+name+'"');console.log('PASS disposable database removed');}
    await admin.end();
  }
}
main().catch(error=>{console.error(error.stack?.replaceAll(testUrl.toString(),'[temporary database]'));process.exitCode=1;});
