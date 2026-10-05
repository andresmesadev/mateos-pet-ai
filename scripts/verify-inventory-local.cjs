// Application verification in a disposable local database; never seeds business data.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'backend/node_modules/dotenv')).config({ path: path.join(root, 'backend/.env'), override: true, quiet: true });
const original = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(original.hostname) && original.pathname === '/mateos_dev', 'Only local mateos_dev allowed');
const { Client, Pool } = require(path.join(root, 'backend/node_modules/pg'));
const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'));
const { PrismaPg } = require(path.join(root, 'backend/node_modules/@prisma/adapter-pg'));
const admin = new Client({ connectionString: original.toString() });
const name = 'mateos_inventory_check_' + randomBytes(6).toString('hex');
const testUrl = new URL(original); testUrl.pathname = '/' + name;
const freshMigrations = process.argv.includes('--fresh-migrations');
let prisma, pool, created = false, passed = 0;
async function check(label, fn) { await fn(); passed++; console.log('PASS ' + label); }
async function rejected(fn, code) { await assert.rejects(fn, e => e.code === code, code); }
async function main() {
  await admin.connect();
  const dump = freshMigrations ? null : spawnSync('docker', ['compose','--env-file','.env.local-db','-f','docker-compose.dev.yml','exec','-T','db','pg_dump','-U','mateos_dev','-d','mateos_dev','--schema-only','--no-owner','--no-privileges','--schema=public'], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (dump) assert.equal(dump.status, 0, 'Local schema dump failed');
  await admin.query('CREATE DATABASE "' + name + '"'); created = true;
  const setup = new Client({ connectionString: testUrl.toString() }); await setup.connect();
  try {
    await setup.query('CREATE EXTENSION IF NOT EXISTS vector');
    if (dump) {
      const sql = dump.stdout.replace(/^\\(?:un)?restrict.*$/gm, '').replace(/^CREATE SCHEMA public;$/gm, '');
      await setup.query(sql);
    }
  } finally { await setup.end(); }
  if (freshMigrations) {
    const cli = path.join(root, 'node_modules/prisma/build/index.js');
    for (const args of [
      ['validate'],
      ['migrate', 'deploy'],
      ['migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code'],
    ]) {
      const checked = spawnSync(process.execPath, [cli, ...args], { cwd: root, env: { ...process.env, DATABASE_URL: testUrl.toString() }, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
      // Avoid printing connection details from CLI diagnostics.
      if (checked.status !== 0) console.error((checked.stderr + checked.stdout).replaceAll(testUrl.toString(), '[temporary local database]'));
      assert.equal(checked.status, 0, 'Fresh migration check: ' + args.join(' '));
      console.log('PASS fresh database: prisma ' + args.join(' '));
    }
  }
  pool = new Pool({ connectionString: testUrl.toString(), max: 8 });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const uow = { run: (fn, options) => prisma.$transaction(tx => fn({ tx }), options) };
  const { buildInventoryContext } = require('../backend/src/contexts/inventory');
  const { buildConfirmPosSale } = require('../backend/src/application/workflows/pos/confirm-pos-sale');
  const finance = require('../backend/src/contexts/finance');
  let now = new Date('2026-10-02T15:00:00Z');
  const events = [];
  const inv = buildInventoryContext({ unitOfWork: uow, clock: () => now, eventPublisher: { publish: async (...args) => events.push(args) } });
  const confirm = buildConfirmPosSale({ inventory: inv.commands, finance, repository: inv.repository, accessReader: inv.accessReader, unitOfWork: uow, clock: () => now });
  const tenant = await prisma.tenant.create({ data: { name:'Test inventory', slug:'inventory-a', phone:'inventory-a', activeModules:['retail','veterinary','grooming'] } });
  const other = await prisma.tenant.create({ data: { name:'Other', slug:'inventory-b', phone:'inventory-b', activeModules:['retail'] } });
  const actor = { type:'admin', email:'inventory@example.invalid', name:'Prueba' };
  const identity = { tenantId: tenant.id, actor };
  const call = (method, kind, command, operationKey = randomUUID(), who = identity) => inv.commands[method]({ ...who, kind, command, operationKey });
  const create = (code, extra = {}) => call('catalogue','create_product', { name:code, category:'Productos', internalCode:code, barcode:null, presentation:'Frasco', uses:['retail','veterinary'], referenceCost:'500', salePrice:'1000', stockMinimum:2, lotPolicy:'untracked', ...extra });
  const entry = (p, quantity, extra = {}, operationKey) => call('entry','register_entry', { productId:p.id, quantity, unitCost:'500', ...extra }, operationKey);
  const detail = p => inv.reads.detail({ ...identity, id:p.id });
  const counts = async () => [await prisma.transaction.count(), await prisma.inventoryOperation.count(), await prisma.inventoryMovement.count()];
  const sale = (items, operationKey = randomUUID(), who = identity, extra = {}) => confirm({ ...who, operationKey, command:{ paymentMethod:'cash', items, ...extra } });
  const line = (p, quantity = 1) => ({ description:p.name, itemKind:'product', productId:p.id, quantity, unitPrice:1000, priceVersion:p.priceVersion });
  let p, q, lotp;
  await check('Catalogue starts at zero and entry records units', async () => { p=(await create('SKU-A')).product; await entry(p,10); assert.equal((await detail(p)).available,'10'); });
  await check('Malformed uses rejected explicitly', () => rejected(() => create('BAD',{uses:{}}),'INVALID_USE'));
  await check('Entry retry is idempotent and event emitted once', async () => { const k=randomUUID(), n=events.length; await entry(p,2,{},k); const r=await entry(p,2,{},k); assert(r.replayed); assert.equal(events.length,n+1); assert.equal((await detail(p)).available,'12'); await rejected(()=>entry(p,3,{},k),'OPERATION_CONTENT_CHANGED'); });
  await check('Concurrent same-key entry has one effect', async () => { const k=randomUUID(); await Promise.all([entry(p,1,{},k),entry(p,1,{},k)]); assert.equal((await detail(p)).available,'13'); });
  await check('Mixed sale rollback preserves money and stock', async () => { q=(await create('SKU-EMPTY')).product; const before=await counts(); await rejected(()=>sale([line(p),line(q),{description:'Servicio',itemKind:'service',quantity:1,unitPrice:500}]),'INSUFFICIENT_STOCK'); assert.deepEqual(await counts(),before); assert.equal((await detail(p)).available,'13'); });
  await check('Repeated SKU quantities validated together',()=>rejected(()=>sale([line(p,8),line(p,8)]),'INSUFFICIENT_STOCK'));
  await check('Browser cannot inject trusted product snapshots into manual lines',async()=>{const before=(await detail(p)).available;const r=await sale([{description:'Manual',itemKind:'product',quantity:1,unitPrice:1000,product:{id:p.id,internalCode:p.internalCode,presentation:p.presentation,priceVersion:p.priceVersion}}]);assert.equal(r.transaction.items[0].productId,null);assert.equal((await detail(p)).available,before);});
  await check('Sale retry returns same money fact without another stock exit', async () => { const k=randomUUID(); const a=await sale([line(p,2)],k), b=await sale([line(p,2)],k); assert.equal(a.transaction.id,b.transaction.id); assert.equal((await detail(p)).available,'11'); assert(b.replayed); });
  await check('Last-unit race never oversells', async () => { const one=(await create('LAST')).product; await entry(one,1); const outcomes=await Promise.allSettled([sale([line(one)]),sale([line(one)])]); assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1); assert.equal((await detail(one)).available,'0'); assert.equal(outcomes.find(o=>o.status==='rejected').reason.code,'INSUFFICIENT_STOCK'); });
  await check('Price version mismatch rejects entire sale', async () => { const d=await detail(p); await call('catalogue','update_product',{productId:p.id,expectedVersion:d.metadataVersion,salePrice:'1200'}); await rejected(()=>sale([line(p)]),'PRICE_CHANGED'); });
  await check('Used presentation cannot be changed', async () => { const d=await detail(p); await rejected(()=>call('catalogue','update_product',{productId:p.id,expectedVersion:d.metadataVersion,presentation:'Caja'}),'PRODUCT_POLICY_USED'); });
  await check('FEFO consumes earliest valid lot', async () => { lotp=(await create('LOTS',{lotPolicy:'lot_expiry'})).product; await entry(lotp,3,{lotCode:'LATE',expiresOn:'2026-12-01'}); await entry(lotp,2,{lotCode:'EARLY',expiresOn:'2026-10-03'}); const r=await sale([line(lotp,3)]); const m=await prisma.inventoryMovement.findMany({where:{operationId:r.operationId},orderBy:{ordinal:'asc'}}); assert.deepEqual(m.map(x=>[x.lotCodeSnapshot,x.quantity]),[['EARLY',2],['LATE',1]]); });
  await check('Expiry date itself is unavailable in Bogota', async () => { await entry(lotp,1,{lotCode:'TODAY',expiresOn:'2026-10-03'}); now=new Date('2026-10-03T05:01:00Z'); const d=await detail(lotp); assert.equal(d.expired,'1'); assert.equal(d.available,'2'); now=new Date('2026-10-02T15:00:00Z'); });
  await check('Zero-difference count preserves revision and records evidence', async () => { const d=await detail(p), before=await prisma.inventoryMovement.count(); const r=await call('adjust','adjust_stock',{productId:p.id,lotId:d.lots[0].id,expectedStockRevision:d.stockRevision,countedQuantity:d.lots[0].physical,reason:'Conteo verificado'}); assert.equal(r.evidence.difference,0); assert.equal((await detail(p)).stockRevision,d.stockRevision); assert.equal(await prisma.inventoryMovement.count(),before); });
  await check('Stale count revision rejected', async () => { const d=await detail(p); await entry(p,1); await rejected(()=>call('adjust','adjust_stock',{productId:p.id,lotId:d.lots[0].id,expectedStockRevision:d.stockRevision,countedQuantity:0,reason:'Conteo'}),'STOCK_COUNT_CHANGED'); });
  const vet=await prisma.staff.create({data:{tenantId:tenant.id,name:'Vet',role:'vet',accessPermissions:['inventory_consume'],credential:{create:{email:'vet@example.invalid',passwordHash:'test-only'}}}});
  const vi={tenantId:tenant.id,actor:{type:'vet',staffId:vet.id,sessionVersion:1}};
  let consumption;
  await check('Professional can consume without cash and cannot see costs', async () => { const d=await inv.reads.detail({...vi,id:p.id}); assert(!('referenceCost' in d)); assert(!('salePrice' in d)); const k=randomUUID(); consumption=await call('consume','register_consumption',{area:'veterinary',reason:'Preparación de material',items:[{productId:p.id,quantity:2}]},k,vi); assert(!('entryUnitCost' in consumption.movements[0])); consumption.key=k; await rejected(()=>sale([line(q)],randomUUID(),vi),'ACCESS_DENIED'); });
  await check('Professional cannot use another area',()=>rejected(()=>call('consume','register_consumption',{area:'grooming',reason:'Material',items:[{productId:p.id,quantity:1}]},undefined,vi),'ACCESS_DENIED'));
  await check('Current permission checked on recovery', async () => { await prisma.staff.update({where:{id:vet.id},data:{accessPermissions:[]}}); await rejected(()=>inv.commands.recover({...vi,kind:'register_consumption',operationKey:consumption.key}),'ACCESS_DENIED'); await prisma.staff.update({where:{id:vet.id},data:{accessPermissions:['inventory_consume']}}); });
  await check('Changed professional role cannot recover another area', async () => { await prisma.staff.update({where:{id:vet.id},data:{role:'groomer'}}); await rejected(()=>inv.commands.recover({...vi,kind:'register_consumption',operationKey:consumption.key}),'ACCESS_DENIED'); await prisma.staff.update({where:{id:vet.id},data:{role:'vet'}}); });
  await check('Consumption linked only to own started attention', async () => {
    const owner=await prisma.user.create({data:{tenantId:tenant.id,phone:'test-owner'}});
    const appt=await prisma.appointment.create({data:{tenantId:tenant.id,userId:owner.id,petName:'Test',petType:'dog',serviceType:'consulta',staffId:vet.id,date:now,status:'confirmed'}});
    const body={area:'veterinary',appointmentId:appt.id,items:[{productId:p.id,quantity:1}]};
    await rejected(()=>call('consume','register_consumption',body,undefined,vi),'ATTENTION_NOT_STARTED');
    await prisma.appointment.update({where:{id:appt.id},data:{status:'in_progress',staffId:null}});
    await rejected(()=>call('consume','register_consumption',body,undefined,vi),'ACCESS_DENIED');
    await prisma.appointment.update({where:{id:appt.id},data:{staffId:vet.id}});
    const r=await call('consume','register_consumption',body,undefined,vi);assert.equal(r.movements[0].appointmentId,appt.id);
  });
  await check('Consumption correction bounded cumulatively', async () => { const m=consumption.movements[0]; await call('correct','correct_consumption',{sourceOperationId:consumption.operationId,sourceMovementId:m.id,quantity:1,reason:'Unidad no utilizada'}); await rejected(()=>call('correct','correct_consumption',{sourceOperationId:consumption.operationId,sourceMovementId:m.id,quantity:2,reason:'Exceso'}),'CORRECTION_EXCEEDS_SOURCE'); });
  await check('Tenant and missing identity cannot cross boundaries', async () => { await rejected(()=>inv.reads.detail({tenantId:other.id,actor,id:p.id}),'PRODUCT_NOT_FOUND'); await rejected(()=>inv.reads.list({tenantId:tenant.id,actor:null}),'ACCESS_DENIED'); await rejected(()=>sale([line(q)],undefined,identity,{tenantId:other.id}),'INVALID_IDENTITY'); });
  await check('Module deactivation blocks new catalogue sales', async () => {await prisma.tenant.update({where:{id:tenant.id},data:{activeModules:['veterinary','grooming']}});await rejected(()=>sale([line(lotp)]),'ACCESS_DENIED');await prisma.tenant.update({where:{id:tenant.id},data:{activeModules:['retail','veterinary','grooming']}});});
  await check('Global stock filters include low and expired goods across pages',async()=>{assert((await inv.reads.list({...identity,query:{status:'low'}})).data.some(x=>x.id===q.id));now=new Date('2026-10-03T05:01:00Z');assert((await inv.reads.list({...identity,query:{status:'expired'}})).data.some(x=>x.id===lotp.id));now=new Date('2026-10-02T15:00:00Z');});
  const rs=await sale([line(lotp)]);
  await check('Stock return requires voided manual sale',()=>rejected(()=>call('returnItems','return_sale_items',{transactionId:rs.transaction.id,reason:'Devolución',items:[{transactionItemId:rs.transaction.items[0].id,disposition:'restock'}]}),'SALE_NOT_VOIDED'));
  await check('Voiding money does not return stock', async () => { const before=await detail(lotp); await prisma.transaction.update({where:{id:rs.transaction.id},data:{status:'voided',voidReason:'Test'}}); assert.equal((await detail(lotp)).available,before.available); });
  await check('Whole-line return restores original lot once', async () => { const d=await detail(lotp); const body={transactionId:rs.transaction.id,reason:'Mercancía recibida',items:[{transactionItemId:rs.transaction.items[0].id,disposition:'restock'}]}; await call('returnItems','return_sale_items',body); assert.equal(BigInt((await detail(lotp)).available),BigInt(d.available)+1n); await rejected(()=>call('returnItems','return_sale_items',body),'ITEM_ALREADY_RETURNED'); });
  await check('Discard return records received goods without restoring stock', async () => { const s=await sale([line(lotp)]); await prisma.transaction.update({where:{id:s.transaction.id},data:{status:'voided',voidReason:'Test'}}); const d=await detail(lotp); const r=await call('returnItems','return_sale_items',{transactionId:s.transaction.id,reason:'Producto dañado',items:[{transactionItemId:s.transaction.items[0].id,disposition:'discard'}]}); assert.equal(r.movements[0].stockDelta,0); assert.equal((await detail(lotp)).available,d.available); });
  await check('Expired returns must be received as non-usable goods',async()=>{const exp=(await create('EXPIRED-RETURN',{lotPolicy:'lot_expiry'})).product;await entry(exp,1,{lotCode:'E',expiresOn:'2026-10-03'});const s=await sale([line(exp)]);await prisma.transaction.update({where:{id:s.transaction.id},data:{status:'voided',voidReason:'Test'}});now=new Date('2026-10-03T15:00:00Z');const body={transactionId:s.transaction.id,reason:'Recibido vencido',items:[{transactionItemId:s.transaction.items[0].id,disposition:'restock'}]};await rejected(()=>call('returnItems','return_sale_items',body),'LOT_EXPIRED');body.items[0].disposition='discard';await call('returnItems','return_sale_items',body);assert.equal((await detail(exp)).physical,'0');now=new Date('2026-10-02T15:00:00Z');});
  await check('Reception cannot recover a sale from another civil day',async()=>{const reception=await prisma.staff.create({data:{tenantId:tenant.id,name:'Reception',role:'receptionist',credential:{create:{email:'reception@example.invalid',passwordHash:'test-only'}}}});const ri={tenantId:tenant.id,actor:{type:'receptionist',staffId:reception.id,sessionVersion:1}},k=randomUUID();await entry(q,1);await sale([line(q)],k,ri);now=new Date('2026-10-03T15:00:00Z');await rejected(()=>inv.commands.recover({...ri,kind:'confirm_pos_sale',operationKey:k}),'ACCESS_DENIED');now=new Date('2026-10-02T15:00:00Z');});
  await check('Inventory evidence cannot be rewritten', async () => { const m=await prisma.inventoryMovement.findFirst(); await assert.rejects(()=>prisma.inventoryMovement.update({where:{id:m.id},data:{reason:'Rewrite'}})); });
  await check('Unknown sale and foreign history cursor are rejected', async () => { await rejected(()=>call('returnItems','return_sale_items',{transactionId:randomUUID(),reason:'Return',items:[]}),'SALE_NOT_FOUND'); await rejected(()=>inv.reads.movements({...identity,id:p.id,cursor:randomUUID()}),'INVALID_CURSOR'); });
  await check('Product pagination binds account and filters, with exact code matching', async () => {
    const first=await inv.reads.list({...identity,query:{limit:'1'}}); assert(first.nextCursor);
    const next=await inv.reads.list({...identity,query:{limit:'1',cursor:first.nextCursor}}); assert.notEqual(next.data[0].id,first.data[0].id);
    await rejected(()=>inv.reads.list({...identity,query:{limit:'1',use:'grooming',cursor:first.nextCursor}}),'INVALID_CURSOR');
    const coded=(await create('UNIQUE-CODE-900',{name:'Artículo de prueba independiente'})).product;
    const exact=await inv.reads.list({...identity,query:{search:coded.internalCode}}); assert(exact.data.some(i=>i.id===coded.id));
    const partial=await inv.reads.list({...identity,query:{search:coded.internalCode.slice(0,-1)}}); assert(!partial.data.some(i=>i.id===coded.id));
  });
  await check('Version boundaries reject increments and roll back inventory effects', async () => {
    const bounded=(await create('VERSION-LIMIT')).product;
    await prisma.inventoryProduct.update({where:{id:bounded.id},data:{stockRevision:2147483647}});
    const before=await counts();
    await rejected(()=>entry(bounded,1),'VERSION_LIMIT'); assert.deepEqual(await counts(),before); assert.equal((await detail(bounded)).physical,'0');
    await prisma.inventoryProduct.update({where:{id:bounded.id},data:{metadataVersion:2147483647}});
    await rejected(()=>call('catalogue','update_product',{productId:bounded.id,expectedVersion:2147483647,name:'Nuevo nombre'}),'VERSION_LIMIT');
  });
  console.log(`Inventory application checks: ${passed} passed, 0 failed. Disposable database only.`);
}
main().catch(e=>{ console.error('FAIL', e.code ?? e.name, e.message, e.meta ? JSON.stringify(e.meta) : ''); process.exitCode=1; }).finally(async()=>{
  if(prisma) await prisma.$disconnect();
  if(pool) await pool.end().catch(()=>{});
  // A validated unique test database is the only permitted cleanup target.
  if(created) { assert(/^mateos_inventory_check_[a-f0-9]{12}$/.test(name)); await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)'); }
  await admin.end().catch(()=>{});
  await require('../backend/src/lib/prisma').$disconnect().catch(()=>{});
});
