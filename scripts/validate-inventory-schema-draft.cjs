// Design validation only. All DDL and fixtures live in a private schema inside
// one ROLLED BACK transaction. Never migrates public or touches business rows.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'backend/node_modules/dotenv')).config({ path: path.join(root, 'backend/.env'), override: true, quiet: true });
const database = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) && database.pathname === '/mateos_dev', 'Only local Docker mateos_dev allowed');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const client = new Client({ connectionString: database.toString(), connectionTimeoutMillis: 5000 });
const schema = 'inventory_design_' + crypto.randomBytes(8).toString('hex');
let passed = 0;
async function reject(label, sql, code, constraint) {
  await client.query('SAVEPOINT negative_case');
  let error;
  try { await client.query(sql); } catch (e) { error = e; }
  await client.query('ROLLBACK TO SAVEPOINT negative_case');
  await client.query('RELEASE SAVEPOINT negative_case');
  assert(error, label + ': expected rejection');
  assert.equal(error.code, code, label);
  if (constraint) assert.equal(error.constraint, constraint, label);
  passed++;
  console.log('PASS ' + label);
}
const product = (id, tenant = 'a', policy = 'untracked') => `INSERT INTO "InventoryProduct"
  ("id", "tenantId", "name", "category", "internalCode", "internalCodeKey", "presentation", "uses", "referenceCost", "salePrice", "lotPolicy", "updatedAt")
  VALUES ('${id}', '${tenant}', 'Producto', 'Insumo', '${id}', '${id}', 'Frasco', ARRAY['retail'], 10, 20, '${policy}', now())`;
const operation = (id, key, kind = 'register_entry', extra = '') => `INSERT INTO "InventoryOperation"
  ("id", "tenantId", "principalKey", "kind", "requestKey", "contractVersion", "payloadHash", "actorId", "actorName", "actorRole", "confirmedAt", "resultKind" ${extra ? ', "resultProductId"' : ''})
  VALUES ('${id}', 'a', 'staff:test', '${kind}', '${key}', 1, repeat('a',64), 'staff:test', 'Prueba', 'admin', now(), '${extra ? 'product' : 'movements'}' ${extra ? `, '${extra}'` : ''})`;
const lot = (id, productId = 'p', tenant = 'a', extra = '') => `INSERT INTO "InventoryLot"
  ("id", "tenantId", "productId", "groupKind", "firstReceivedAt", "updatedAt" ${extra ? ', "commercialCode", "commercialKey", "expiresOn"' : ''})
  VALUES ('${id}', '${tenant}', '${productId}', '${extra ? 'commercial' : 'untracked'}', now(), now() ${extra ? ", 'L1', 'l1', DATE '2027-01-01'" : ''})`;

async function main() {
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    await client.query(`CREATE TABLE "Tenant" (id TEXT PRIMARY KEY);
      CREATE TABLE "Transaction" (id TEXT PRIMARY KEY, "tenantId" TEXT);
      CREATE TABLE "Appointment" (id TEXT PRIMARY KEY, "tenantId" TEXT);
      CREATE TABLE "TransactionItem" (id TEXT PRIMARY KEY, "transactionId" TEXT NOT NULL REFERENCES "Transaction"(id) ON DELETE CASCADE,
        description TEXT NOT NULL, "itemKind" TEXT NOT NULL DEFAULT 'legacy', quantity INT NOT NULL DEFAULT 1,
        "unitPrice" DECIMAL(10,2) NOT NULL, total DECIMAL(10,2) NOT NULL);
      INSERT INTO "Tenant" VALUES ('a'), ('b');
      INSERT INTO "Transaction" VALUES ('legacy', NULL), ('sale-a', 'a'), ('sale-b', 'b');
      INSERT INTO "TransactionItem" VALUES ('legacy-item', 'legacy', 'Manual anterior', 'legacy', 1, 15, 15);`);
    const file = fs.readFileSync(path.join(root, 'docs/architecture/inventory-migration-draft.sql'), 'utf8');
    // Strip only top-level transaction wrapper. Keep all constraint SQL intact.
    const ddl = file.replace(/^BEGIN;\r?$/m, '').replace(/^COMMIT;\r?$/m, '');
    assert(!/\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i.test(ddl), 'Draft must be additive');
    await client.query(ddl);
    console.log('PASS additive DDL on PostgreSQL ' + (await client.query('SHOW server_version')).rows[0].server_version);
    passed++;
    assert.equal((await client.query('SELECT "productId" FROM "TransactionItem" WHERE id = \'legacy-item\'')).rows[0].productId, null);
    console.log('PASS historical manual item preserved without product or stock'); passed++;
    await client.query(product('p'));
    await client.query(product('p-b', 'b'));
    await client.query(product('expiry', 'a', 'lot_expiry'));
    await reject('non-finite product price', `UPDATE "InventoryProduct" SET "salePrice"='NaN'::NUMERIC WHERE id='p'`, '23514', 'inventory_product_values');
    await reject('non-finite reference cost', `UPDATE "InventoryProduct" SET "referenceCost"='NaN'::NUMERIC WHERE id='p'`, '23514', 'inventory_product_values');
    await client.query(lot('l'));
    await client.query(lot('expires', 'expiry', 'a', 'commercial'));
    await reject('negative balance', `UPDATE "InventoryLot" SET "balancePhysical" = -1 WHERE id = 'l'`, '23514', 'inventory_lot_shape');
    await reject('cross-tenant lot', lot('foreign', 'p', 'b'), '23514', 'inventory_lot_policy');
    await reject('one untracked grouping per product', lot('duplicate'), '23505', 'InventoryLot_untracked_key');
    await reject('required expiry', `INSERT INTO "InventoryLot" (id,"tenantId","productId","groupKind","commercialCode","commercialKey","firstReceivedAt","updatedAt") VALUES ('missing-date','a','expiry','commercial','L2','l2',now(),now())`, '23514', 'inventory_lot_policy');
    await reject('immutable expiry', `UPDATE "InventoryLot" SET "expiresOn" = DATE '2028-01-01' WHERE id = 'expires'`, '23514', 'inventory_lot_immutable');
    await client.query(`UPDATE "InventoryProduct" SET barcode = '00001234' WHERE id = 'p'`);
    assert.equal((await client.query(`SELECT barcode FROM "InventoryProduct" WHERE id = 'p'`)).rows[0].barcode, '00001234');
    console.log('PASS barcode preserves leading zeros'); passed++;
    await reject('barcode uniqueness within tenant', `UPDATE "InventoryProduct" SET barcode = '00001234' WHERE id = 'expiry'`, '23505', 'InventoryProduct_barcode_key');
    await client.query(`UPDATE "InventoryProduct" SET barcode = '00001234' WHERE id = 'p-b'`);
    console.log('PASS same barcode allowed in another tenant'); passed++;
    await reject('catalog item cannot bypass tenant with NULL', `INSERT INTO "TransactionItem" (id,"transactionId",description,"itemKind",quantity,"unitPrice",total,"productId","productCodeSnapshot","presentationSnapshot","priceSourceSnapshot","priceVersionSnapshot") VALUES ('bad-item','sale-a','P','product',1,20,20,'p','p','Frasco','product_base_price',1)`, '23514', 'inventory_item_shape');
    await reject('catalog item cannot refer to foreign sale', `INSERT INTO "TransactionItem" (id,"tenantId","transactionId",description,"itemKind",quantity,"unitPrice",total,"productId","productCodeSnapshot","presentationSnapshot","priceSourceSnapshot","priceVersionSnapshot") VALUES ('bad-item','a','sale-b','P','product',1,20,20,'p','p','Frasco','product_base_price',1)`, '23503', 'TransactionItem_tenantId_transactionId_fkey');
    await client.query(`INSERT INTO "TransactionItem" (id,"tenantId","transactionId",description,"itemKind",quantity,"unitPrice",total,"productId","productCodeSnapshot","presentationSnapshot","priceSourceSnapshot","priceVersionSnapshot") VALUES ('item','a','sale-a','P','product',1,20,20,'p','p','Frasco','product_base_price',1)`);
    await reject('historical catalogue price immutable', `UPDATE "TransactionItem" SET "unitPrice"=25,total=25 WHERE id='item'`, '23514', 'inventory_item_immutable');
    const key = '00000000-0000-4000-8000-000000000001';
    await client.query(operation('op', key));
    await reject('request identity unique', operation('op-duplicate', key), '23505', 'InventoryOperation_request_key');
    await reject('confirmed operation immutable', `UPDATE "InventoryOperation" SET "payloadHash"=repeat('b',64) WHERE id='op'`, '23514', 'inventory_fact_immutable');
    await reject('unknown operation kind', operation('pending', '00000000-0000-4000-8000-000000000002', 'pending'), '23514', 'inventory_operation_shape');
    await client.query(`INSERT INTO "InventoryMovement" (id,"tenantId","operationId","productId","lotId",ordinal,kind,quantity,"stockDelta","balanceBefore","balanceAfter","occurredAt","actorId","actorName","actorRole","productNameSnapshot","productCodeSnapshot","presentationSnapshot","entryUnitCost") VALUES ('m','a','op','p','l',1,'entry',5,5,0,5,now(),'staff:test','Prueba','admin','Producto','p','Frasco',10)`);
    await client.query(`UPDATE "InventoryLot" SET "balancePhysical"=5 WHERE id='l'`);
    await reject('movement immutable', `UPDATE "InventoryMovement" SET quantity=6,"stockDelta"=6,"balanceAfter"=6 WHERE id='m'`, '23514', 'inventory_fact_immutable');
    await reject('used presentation immutable', `UPDATE "InventoryProduct" SET presentation='Caja' WHERE id='p'`, '23514', 'inventory_policy_used');
    await reject('balance arithmetic enforced', `INSERT INTO "InventoryMovement" (id,"tenantId","operationId","productId","lotId",ordinal,kind,quantity,"stockDelta","balanceBefore","balanceAfter","occurredAt","actorId","actorName","actorRole","productNameSnapshot","productCodeSnapshot","presentationSnapshot","entryUnitCost") VALUES ('bad-m','a','op','p','l',2,'entry',1,1,5,9,now(),'staff:test','Prueba','admin','Producto','p','Frasco',10)`, '23514', 'inventory_movement_values');
    await client.query(operation('return-op', '00000000-0000-4000-8000-000000000003').replace("'register_entry'", "'return_sale_items'").replace("'movements'", "'returns'"));
    await client.query(`INSERT INTO "InventoryReturnLine" (id,"tenantId","operationId","transactionId","transactionItemId","productId",quantity,disposition,reason,"recordedAt") VALUES ('r','a','return-op','sale-a','item','p',1,'discard','No apto',now())`);
    await reject('return limited to one per sold line', `INSERT INTO "InventoryReturnLine" (id,"tenantId","operationId","transactionId","transactionItemId","productId",quantity,disposition,reason,"recordedAt") VALUES ('r2','a','return-op','sale-a','item','p',1,'discard','Otro',now())`, '23505', 'InventoryReturnLine_once_key');
    await reject('return fact retained', `DELETE FROM "InventoryReturnLine" WHERE id='r'`, '23514', 'inventory_fact_immutable');
    // A terminal result can reference a product created later in its transaction.
    await client.query(operation('create-op', '00000000-0000-4000-8000-000000000004', 'create_product', 'future'));
    await client.query(product('future'));
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    console.log('PASS terminal operation with result FK deferred until destination exists'); passed++;
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    await reject('deferred result cannot commit an orphan', operation('orphan-op', '00000000-0000-4000-8000-000000000005', 'create_product', 'missing') + '; SET CONSTRAINTS ALL IMMEDIATE', '23503', 'InventoryOperation_tenantId_resultProductId_fkey');
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  } finally {
    await client.query('ROLLBACK');
    const remaining = await client.query('SELECT count(*)::INT AS count FROM pg_namespace WHERE nspname=$1', [schema]);
    assert.equal(remaining.rows[0].count, 0, 'Disposable schema must not remain');
    console.log('ROLLBACK verified: no schema, tables or fixtures persisted');
    await client.end();
  }
  console.log(`Design checks: ${passed} passed, 0 failed (not an inventory application test)`);
}
main().catch(e => { console.error('Draft validation failed:', e.code ?? e.name, e.constraint ?? '', e.message); process.exitCode = 1; });
