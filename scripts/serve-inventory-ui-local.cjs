// Isolated UI verification: temporary PostgreSQL database and dedicated local ports.
// Requires the frontend production build. Enter "stop" to stop and drop this private fixture.
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'backend/node_modules/dotenv')).config({path:path.join(root,'backend/.env'),quiet:true});
const { Client, Pool } = require(path.join(root,'backend/node_modules/pg'));
const original = new URL(process.env.DATABASE_URL);
assert(['localhost','127.0.0.1'].includes(original.hostname) && original.pathname==='/mateos_dev', 'Local database only');
const name = 'mateos_inventory_check_' + randomBytes(6).toString('hex');
const isolated = new URL(original); isolated.pathname = '/' + name;
const admin = new Client({connectionString:original.toString()});
let server, frontend, prisma, fixturePool, created=false;
async function main() {
  await admin.connect();
  const dump=spawnSync('docker',['compose','--env-file','.env.local-db','-f','docker-compose.dev.yml','exec','-T','db','pg_dump','-U','mateos_dev','-d','mateos_dev','--schema-only','--no-owner','--no-privileges','--schema=public'],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
  assert.equal(dump.status,0,'Local schema dump failed');
  await admin.query('CREATE DATABASE "'+name+'"');created=true;
  console.log('Private database: ' + name);
  const setup=new Client({connectionString:isolated.toString()});await setup.connect();
  try {
    await setup.query('CREATE EXTENSION IF NOT EXISTS vector');
    await setup.query(dump.stdout.replace(/^\\(?:un)?restrict.*$/gm,'').replace(/^CREATE SCHEMA public;$/gm,''));
    await setup.query('SET search_path TO public');
    // Event types are global configuration; no tenant, customer or sales data is copied.
    const {rows:eventTypes}=await admin.query('SELECT id,name,"originContext","payloadContractDescription",active,"createdAt" FROM "EventType"');
    for(const eventType of eventTypes) await setup.query('INSERT INTO "EventType" (id,name,"originContext","payloadContractDescription",active,"createdAt") VALUES ($1,$2,$3,$4,$5,$6)',[eventType.id,eventType.name,eventType.originContext,eventType.payloadContractDescription,eventType.active,eventType.createdAt]);
  } finally { await setup.end(); }
  process.env.DATABASE_URL=isolated.toString();
  // The fixture owns this pool and closes it before dropping its database.
  // PrismaPg does not dispose an externally supplied pool by default.
  const { PrismaClient } = require(path.join(root,'backend/node_modules/@prisma/client'));
  const { PrismaPg } = require(path.join(root,'backend/node_modules/@prisma/adapter-pg'));
  fixturePool=new Pool({connectionString:isolated.toString()});
  global.prisma=new PrismaClient({adapter:new PrismaPg(fixturePool)});
  prisma=require('../backend/src/lib/prisma');
  const tenant=await prisma.tenant.create({data:{name:'Inventario · prueba temporal',slug:name,phone:name,activeModules:['retail','veterinary','grooming']}});
  process.env.SINGLE_TENANT_ID=tenant.id;
  const seedReports = process.argv.includes('--seed-reports');
  const seedPagination = process.argv.includes('--seed-pagination');
  const seedHistory = seedReports || process.argv.includes('--seed-history');
  const seedCash = seedHistory || process.argv.includes('--seed-cash');
  const seedCheckout = seedCash || process.argv.includes('--seed-checkout');
  const seedPos = seedCheckout || process.argv.includes('--seed-pos');
  if (seedCheckout) {
    // Disposable credentials exist only in this private process, never in project env files.
    process.env.ADMIN_EMAIL='pos-ui@example.invalid';
    process.env.ADMIN_PASSWORD='LocalPosCheck2026!';
    const owner=await prisma.user.create({data:{tenantId:tenant.id,name:'Cliente de prueba POS',phone:'0000000000'}});
    await prisma.pet.createMany({data:[{tenantId:tenant.id,ownerId:owner.id,name:'Luna de prueba',type:'dog',defaultGroomingPrice:'55000'},{tenantId:tenant.id,ownerId:owner.id,name:'Toby de prueba',type:'dog',defaultGroomingPrice:'75000'}]});
    const grooming=await prisma.serviceCategory.create({data:{tenantId:tenant.id,name:'grooming'}});
    const veterinary=await prisma.serviceCategory.create({data:{tenantId:tenant.id,name:'veterinary'}});
    await prisma.service.createMany({data:[{tenantId:tenant.id,name:'Baño de prueba',categoryId:grooming.id,duration:30,basePrice:'45000'},{tenantId:tenant.id,name:'Servicio sin tarifa',categoryId:veterinary.id,duration:30}]});
    if (seedCash) {
      const pet = await prisma.pet.findFirst({ where: { ownerId: owner.id } });
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const paidAt = new Date(today + 'T10:00:00-05:00');
      const yesterday = new Date(paidAt.getTime() - 86400000);
      const appointment = await prisma.appointment.create({ data: { tenantId: tenant.id, userId: owner.id, petId: pet.id, petName: pet.name, petType: pet.type, serviceType: 'grooming', date: paidAt, status: 'completed', finalPrice: '55000' } });
      const common = { tenantId: tenant.id, userId: owner.id, petId: pet.id, paidAt };
      await prisma.transaction.create({ data: { ...common, appointmentId: appointment.id, origin: 'system_appointment_completed', total: '55000', items: { create: [{ description: 'Baño básico para revisar', quantity: 1, unitPrice: '55000', total: '55000' }] } } });
      for (const [method, amount] of [['cash', '12000.30'], ['transfer', '24000'], ['card', '36000'], ['other', '6000']]) {
        await prisma.transaction.create({ data: { ...common, total: amount, paymentMethod: method, origin: 'manual_pos_sale', recordedActorId: 'admin:pos-ui@example.invalid', recordedActorName: 'Prueba POS', recordedActorRole: 'admin', items: { create: [{ description: 'Producto de prueba ' + method, quantity: 1, unitPrice: amount, total: amount }] } } });
      }
      await prisma.transaction.create({ data: { ...common, paidAt: yesterday, total: '8000.25', paymentMethod: 'transfer', recordedActorId: 'admin:pos-ui@example.invalid', items: { create: [{ description: 'Servicio de ayer', quantity: 1, unitPrice: '8000.25', total: '8000.25' }] } } });
      await prisma.expense.createMany({ data: [{ tenantId: tenant.id, date: paidAt, category: 'supplies', description: 'Insumos de prueba', amount: '10000.10', paymentMethod: 'cash', notes: 'Comprobante de prueba' }, { tenantId: tenant.id, date: paidAt, category: 'salary', description: 'Pago de prueba al equipo', amount: '5000', paymentMethod: 'transfer' }, { tenantId: tenant.id, date: yesterday, description: 'Gasto de ayer', amount: '3000', paymentMethod: 'transfer' }] });
      console.log('Private cash fixture: 5 current movements, 1 payment to review, 2 current expenses, and yesterday records.');
      if (seedHistory) {
        for (let index = 0; index < 12; index++) {
          const voided = index === 11;
          await prisma.transaction.create({ data: { ...common, paidAt: new Date(paidAt.getTime() + (index + 1) * 60000), total: '12.34', paymentMethod: index % 2 ? 'card' : 'cash', origin: 'manual_pos_sale', recordedActorId: 'admin:pos-ui@example.invalid', recordedActorName: index % 2 ? 'María Gómez' : 'Ana Pérez', status: voided ? 'voided' : 'active', ...(voided ? { voidReason: 'Anulación de prueba anterior', voidedAt: paidAt } : {}), items: { create: [{ description: 'Artículo de historial ' + (index + 1), quantity: 1, unitPrice: '12.34', total: '12.34', ...(seedReports ? { itemKind: index === 0 ? 'service' : index === 1 ? 'product' : 'legacy' } : {}) }] } } });
        }
        console.log('Private history fixture: 18 records, 1 annulled; current active total=133136.04, full range active total=141136.29.');
      }
      if (seedReports) {
        await prisma.expense.create({ data: { tenantId: tenant.id, date: paidAt, description: 'Egreso anulado de prueba', amount: '999.99', paymentMethod: 'cash', status: 'voided', voidReason: 'Duplicado', voidedAt: paidAt } });
        await prisma.appointment.createMany({ data: ['confirmed', 'cancelled', 'no_show'].map((status, index) => ({ tenantId: tenant.id, userId: owner.id, petId: pet.id, petName: pet.name, petType: pet.type, serviceType: 'grooming', date: new Date(paidAt.getTime() + (index + 1) * 3600000), status })) });
        console.log('Private reports fixture: 17 active sales=141136.29; 3 active expenses=18000.10; difference=123136.19; 1 completed appointment.');
        if (process.argv.includes('--seed-comparison')) {
          const local = new Date(Date.now() - 5 * 3600000);
          const previousFirst = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1, 15));
          const previousLast = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 0, 15));
          for (const [when, total] of [[previousFirst, '100.25'], [previousLast, '900.50']]) await prisma.transaction.create({ data: { ...common, paidAt: when, total, paymentMethod: 'card', origin: 'manual_pos_sale', recordedActorId: 'admin:pos-ui@example.invalid', recordedActorName: 'Prueba comparación', status: 'active', items: { create: [{ description: 'Servicio de comparación', quantity: 1, unitPrice: total, total, itemKind: 'service' }] } } });
          console.log('Private comparison fixture: previous month first day=100.25, last day=900.50; complete previous total=1000.75.');
        }
      }
    }
  }
  const {inventory}=require('../backend/src/contexts');
  if (seedPagination) {
    const assert = require('node:assert/strict');
    const { readHistoryQuery, readFinancialHistoryPage } = require('../backend/src/routes/dashboard/financial-history-page');
    const { mapTransaction } = require('../backend/src/routes/dashboard/shared');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const start = new Date(today + 'T05:00:00Z');
    const owner = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    const pet = await prisma.pet.findFirst({ where: { tenantId: tenant.id } });
    await prisma.transaction.createMany({ data: Array.from({ length: 211 }, (_, i) => ({ id: 'qa-paged-sale-' + String(i).padStart(3, '0'), tenantId: tenant.id, userId: owner.id, petId: pet.id, paidAt: new Date(start.getTime() + (i + 1) * 1000), total: '1.29', origin: 'manual_pos_sale', status: i === 100 ? 'voided' : 'active', paymentMethod: 'cash', recordedActorId: 'admin:qa', recordedActorName: i === 0 ? 'José Único' : 'Operador paginación' })) });
    await prisma.transactionItem.create({ data: { transactionId: 'qa-paged-sale-000', description: 'Bálsamo único 50%_literal', unitPrice: '1.29', total: '1.29', quantity: 1 } });
    await prisma.expense.createMany({ data: Array.from({ length: 507 }, (_, i) => ({ id: 'qa-paged-expense-' + String(i).padStart(3, '0'), tenantId: tenant.id, date: new Date(start.getTime() + (i + 1) * 1000), amount: '0.29', category: i % 2 ? 'other' : 'supplies', status: i === 100 ? 'voided' : 'active', description: i === 0 ? 'Café único 50%_literal' : 'Insumo paginación ' + i, responsible: 'Ana García' })) });
    const other = await prisma.tenant.create({ data: { name: 'Aislado', slug: name + '-other', phone: name + '-other' } });
    await prisma.transaction.create({ data: { tenantId: other.id, total: '99999', paidAt: start } });
    await prisma.expense.create({ data: { tenantId: other.id, description: 'Café único 50%_literal', amount: '99999', date: start } });
    const include = { user: true, pet: true, items: true };
    const base = { pagination: '1', from: today, to: today, page: '99999', pageSize: '10' };
    for (const kind of ['transactions', 'expenses']) {
      const model = kind === 'transactions' ? prisma.transaction : prisma.expense;
      const dateField = kind === 'transactions' ? 'paidAt' : 'date';
      const money = kind === 'transactions' ? 'total' : 'amount';
      const where = { tenantId: tenant.id, [dateField]: { gte: start, lt: new Date(start.getTime() + 86400000) } };
      const map = kind === 'transactions' ? mapTransaction : row => ({ ...row, amount: Number(row.amount) });
      const read = query => readFinancialHistoryPage(prisma, kind, tenant.id, readHistoryQuery(query, kind), kind === 'transactions' ? include : null, map);
      const last = await read(base);
      assert.equal(last.total, await model.count({ where }));
      assert.equal(last.page, last.totalPages);
      assert.equal(last.data.at(-1).id, kind === 'transactions' ? 'qa-paged-sale-000' : 'qa-paged-expense-000');
      const sum = await model.aggregate({ where: { ...where, status: 'active' }, _sum: { [money]: true } });
      assert.equal(last.summary.activeTotal, Number(sum._sum[money]));
      const search = await read({ ...base, search: kind === 'transactions' ? 'balsamo unico 50%_' : 'cafe unico 50%_' });
      assert.equal(search.total, 1); assert.equal(search.page, 1);
      assert.equal((await read({ ...base, search: '50%_absent' })).total, 0);
      const active = await read({ ...base, status: 'active' });
      assert.equal(active.summary.voidedCount, 0); assert.equal(active.total, await model.count({ where: { ...where, status: 'active' } }));
      console.log('Pagination PostgreSQL verified: ' + kind + ', total=' + last.total + ', pages=' + last.totalPages + ', activeTotal=' + last.summary.activeTotal + ', oldest searchable, escaped wildcards, tenant isolated.');
    }
  }
  const identity={tenantId:tenant.id,actor:{type:'admin',email:process.env.ADMIN_EMAIL||'qa@example.invalid',name:'Prueba POS'}};
  console.log('Private tenant: ' + tenant.id);
  let fixtureProduct, dropSaleResponse=false, dropExpenseResponse=false, dropVoidExpenseResponse=false, dropVoidSaleResponse=false, failHistoryOnce=false, failReportPath=null;
  if(seedPos) {
    fixtureProduct=(await inventory.commands.catalogue({...identity,kind:'create_product',operationKey:randomUUID(),command:{name:'Champú de prueba POS',category:'Aseo',internalCode:'QA-POS',barcode:'00123456789',presentation:'Frasco 250 ml',uses:['retail','veterinary','grooming'],referenceCost:'5000',salePrice:'12000',stockMinimum:1,lotPolicy:'untracked'}})).product;
    await inventory.commands.entry({...identity,kind:'register_entry',operationKey:randomUUID(),command:{productId:fixtureProduct.id,quantity:5,unitCost:'5000'}});
    console.log('Private POS fixture: QA-POS, barcode 00123456789, 5 units. Commands: price-up, price-reset, deactivate, activate, drop-sale-response, stop.');
  }
  const express=require(path.join(root,'backend/node_modules/express'));
  const app=express();app.use(express.json());
  // Test-only transport fault, after an actual private sale has committed.
  app.use((req,res,next)=>{
    if(seedReports && req.method==='GET' && req.path===failReportPath) {
      failReportPath=null;console.log('One private report section failed intentionally.');res.status(503).json({error:'Private test-only outage'});return;
    }
    if(seedHistory && failHistoryOnce && req.method==='GET' && req.path==='/api/dashboard/transactions') {
      failHistoryOnce=false;console.log('One private history read failed intentionally.');res.status(503).json({error:'Private test-only outage'});return;
    }
    if(seedHistory && dropVoidSaleResponse && req.method==='POST' && /^\/api\/dashboard\/transactions\/[^/]+\/void$/.test(req.path)) {
      const send=res.json.bind(res);
      res.json=payload=>{
        if(res.statusCode<300 && payload?.id) {dropVoidSaleResponse=false;console.log('Dropped confirmed private sale annulment response: '+payload.id);res.socket?.destroy();return res;}
        return send(payload);
      };
    }
    if(seedPos && req.method==='POST' && ((dropExpenseResponse && req.path==='/api/dashboard/expenses') || (dropVoidExpenseResponse && /^\/api\/dashboard\/expenses\/[^/]+\/void$/.test(req.path)))) {
      const send=res.json.bind(res);
      res.json=payload=>{
        if(res.statusCode<300 && payload?.id) {dropExpenseResponse=false;dropVoidExpenseResponse=false;console.log('Dropped confirmed private expense response: '+payload.id);res.socket?.destroy();return res;}
        return send(payload);
      };
    }
    if(seedPos && dropSaleResponse && req.method==='POST' && req.path==='/api/dashboard/transactions') {
      const send=res.json.bind(res);
      res.json=payload=>{
        if(res.statusCode<300 && payload?.id) {dropSaleResponse=false;console.log('Dropped one confirmed sale response; private sales='+payload.id);res.socket?.destroy();return res;}
        return send(payload);
      };
    }
    next();
  });
  app.use('/api/dashboard',require('../backend/src/middleware/resolveTenant').resolveTenant,require('../backend/src/routes/dashboard.routes'));
  server=await new Promise((resolve,reject)=>{const s=app.listen(3002,'127.0.0.1',()=>resolve(s));s.on('error',reject);});
  frontend=spawn(process.execPath,[path.join(root,'frontend/node_modules/next/dist/bin/next'),'start','-p','3010','-H','127.0.0.1'],{
    cwd:path.join(root,'frontend'),env:{...process.env,NODE_ENV:'production',API_URL:'http://127.0.0.1:3002',NEXTAUTH_URL:'http://localhost:3010'},stdio:['ignore','pipe','pipe']});
  frontend.stdout.on('data',bytes=>{if(/Ready in/.test(String(bytes)))console.log('UI ready: http://localhost:3010/dashboard/inventory (private fixture; no real stock or money)');});
  frontend.stderr.on('data',bytes=>console.log(String(bytes).slice(-1000)));
  await new Promise((resolve,reject)=>{
    process.stdin.setEncoding('utf8');process.stdin.resume();
    let commandQueue=Promise.resolve();
    process.stdin.on('data',s=>{
      commandQueue=commandQueue.then(async()=>{
        const command=s.trim();
        if(command==='stop') {resolve();return;}
        if(!seedPos) return;
        if(seedReports && ['fail-report-summary-once', 'fail-report-breakdown-once'].includes(command)) { failReportPath='/api/dashboard/reports/'+(command.includes('summary')?'summary':'breakdown'); console.log('Next private report section read will return 503.'); return; }
        if(command==='drop-sale-response') {dropSaleResponse=true;console.log('Next confirmed private sale response will be dropped.');return;}
        if(command==='drop-void-sale-response') {dropVoidSaleResponse=true;console.log('Next confirmed private sale annulment response will be dropped.');return;}
        if(command==='fail-history-once') {failHistoryOnce=true;console.log('Next private history read will return 503.');return;}
        if(command==='drop-expense-response') {dropExpenseResponse=true;console.log('Next confirmed private expense response will be dropped.');return;}
        if(command==='drop-void-expense-response') {dropVoidExpenseResponse=true;console.log('Next confirmed private expense annulment response will be dropped.');return;}
        if(['price-up','price-reset','deactivate','activate'].includes(command)) {
          const current=await inventory.reads.detail({...identity,id:fixtureProduct.id});
          const price=command.startsWith('price-');
          await inventory.commands.catalogue({...identity,kind:price?'update_product':'set_product_active',operationKey:randomUUID(),command:{productId:fixtureProduct.id,expectedVersion:current.metadataVersion,...(price?{salePrice:command==='price-up'?'15000':'12000'}:{active:command==='activate'})}});
          console.log('Private fixture updated: '+command);
        }
      }).catch(e=>console.error('Private fixture command failed: '+e.message));
    });
    frontend.on('exit',code=>code ? reject(new Error('Frontend exited: '+code)) : resolve());
    process.on('SIGINT',resolve);process.on('SIGTERM',resolve);
  });
  console.log('Fixture evidence: products='+await prisma.inventoryProduct.count()+', movements='+await prisma.inventoryMovement.count()+', sales='+await prisma.transaction.count()+', returns='+await prisma.inventoryReturnLine.count()+', expenses='+await prisma.expense.count()+', annulledExpenses='+await prisma.expense.count({where:{status:'voided'}}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
  if(frontend && frontend.exitCode===null)frontend.kill();
  if(server)await new Promise(r=>server.close(r));
  if(prisma)await prisma.$disconnect();
  if(fixturePool)await fixturePool.end();
  if(created && /^mateos_inventory_check_[a-f0-9]{12}$/.test(name))await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');
  await admin.end();process.stdin.pause();console.log('Private UI fixture removed.');
});
