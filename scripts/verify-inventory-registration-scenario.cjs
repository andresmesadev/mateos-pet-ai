const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

module.exports = async function verifyRegistration({ prisma, inv, identity, other, vi, check, rejected, call, create, detail, entry, sale, line }) {
  const sourceFor = p => prisma.inventoryMovement.findFirstOrThrow({ where: { productId: p.id, kind: 'entry' }, orderBy: { occurredAt: 'desc' } });
  const correct = async (p, source, quantity, unitCost = '750', extra = {}, key = randomUUID(), who = identity) => call('correctEntry', 'correct_entry', { productId: p.id, sourceMovementId: source.id, expectedStockRevision: (await detail(p)).stockRevision, quantity, unitCost, reason: 'Corrección de la recepción', ...extra }, key, who);
  const deactivate = async p => call('catalogue', 'set_product_active', { productId: p.id, expectedVersion: (await detail(p)).metadataVersion, active: false });
  const remove = async (p, key = randomUUID(), who = identity, extra = {}) => { const d = await detail(p); return call('catalogue', 'remove_product', { productId: p.id, expectedVersion: d.metadataVersion, expectedStockRevision: d.stockRevision, reason: 'Alta equivocada', ...extra }, key, who); };
  let p, source, replacement;
  await check('Initial stock is an atomic entry at reference cost; same-key replay is harmless', async () => {
    const key = randomUUID();
    const body = { name: 'Inicial', internalCode: 'INIT', category: 'Test', presentation: 'Unidad', uses: ['retail', 'veterinary'], referenceCost: '500', salePrice: '1000', stockMinimum: 0, lotPolicy: 'lot_expiry', initialStock: { quantity: 10, lotCode: 'FIRST', expiresOn: '2026-12-01' } };
    const a = await call('catalogue', 'create_product', body, key);
    const b = await call('catalogue', 'create_product', body, key);
    p = a.product; assert.equal(b.product.id, p.id); assert(b.replayed);
    const d = await detail(p); assert.equal(d.physical, '10'); assert.equal(d.stockRevision, 1);
    source = await sourceFor(p); assert.equal(Number(source.entryUnitCost), 500); assert.equal(source.lotCodeSnapshot, 'FIRST');
    assert.equal(await prisma.inventoryMovement.count({ where: { productId: p.id } }), 1);
  });
  await check('Invalid initial quantity or required lot rolls back the entire product', async () => {
    const before = await prisma.inventoryProduct.count();
    await assert.rejects(() => create('BAD-INITIAL', { initialStock: { quantity: -1 } }));
    await assert.rejects(() => create('BAD-INITIAL-LOT', { lotPolicy: 'lot', initialStock: { quantity: 3 } }));
    assert.equal(await prisma.inventoryProduct.count(), before);
    const zero = (await create('ZERO-INITIAL', { initialStock: { quantity: 0 } })).product;
    assert.equal(await prisma.inventoryLot.count({ where: { productId: zero.id } }), 0);
  });
  await check('Competing product registrations with initial stock cannot duplicate the code or units', async () => {
    const r = await Promise.allSettled([create('COMPETING-INITIAL', { initialStock: { quantity: 4 } }), create('COMPETING-INITIAL', { initialStock: { quantity: 4 } })]);
    assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
    const product = r.find(x => x.status === 'fulfilled').value.product;
    assert.equal((await detail(product)).physical, '4');
    assert.equal(await prisma.inventoryMovement.count({ where: { productId: product.id } }), 1);
  });
  await check('Quantity and cost correction preserves the original and original lot', async () => {
    const original = await prisma.inventoryMovement.findUnique({ where: { id: source.id } });
    const expenses = await prisma.expense.count();
    const r = await correct(p, source, 8);
    assert.deepEqual(r.movements.map(m => [m.kind, m.stockDelta]), [['entry_reversal', -10], ['entry', 8]]);
    assert.equal(r.movements[0].sourceMovementId, source.id);
    replacement = r.movements[1];
    assert.equal(replacement.lotId, source.lotId); assert.equal(Number(replacement.entryUnitCost), 750);
    assert.deepEqual(await prisma.inventoryMovement.findUnique({ where: { id: source.id } }), original);
    assert.equal((await detail(p)).physical, '8'); assert.equal((await detail(p)).stockRevision, 2);
    assert.equal(await prisma.expense.count(), expenses);
    const history = await inv.reads.movements({ ...identity, id: p.id });
    assert.equal(history.data.find(m => m.id === source.id).entryCorrected, true);
    await rejected(() => correct(p, source, 7), 'ENTRY_ALREADY_CORRECTED');
  });
  await check('Correction replay/recovery does not duplicate reversal; increasing quantity is supported', async () => {
    const key = randomUUID(), d = await detail(p);
    const body = { productId: p.id, sourceMovementId: replacement.id, expectedStockRevision: d.stockRevision, quantity: 12, unitCost: '900', reason: 'Recepción real' };
    const a = await call('correctEntry', 'correct_entry', body, key), b = await call('correctEntry', 'correct_entry', body, key);
    assert(b.replayed); assert.equal(a.operationId, b.operationId);
    assert.equal((await inv.commands.recover({ ...identity, kind: 'correct_entry', operationKey: key })).operationId, a.operationId);
    assert.equal((await detail(p)).physical, '12'); replacement = a.movements[1];
    await rejected(() => call('correctEntry', 'correct_entry', { ...body, quantity: 13 }, key), 'OPERATION_CONTENT_CHANGED');
  });
  await check('Stale revision, missing reason, foreign tenant and professional cannot correct entries', async () => {
    await rejected(() => correct(p, replacement, 12, '900', { expectedStockRevision: 0 }), 'STOCK_COUNT_CHANGED');
    await assert.rejects(() => correct(p, replacement, 12, '900', { reason: '' }));
    await rejected(() => correct(p, replacement, 12, '900', {}, randomUUID(), { tenantId: other.id, actor: identity.actor }), 'PRODUCT_NOT_FOUND');
    await rejected(() => correct(p, replacement, 12, '900', {}, randomUUID(), vi), 'ACCESS_DENIED');
  });
  await check('Concurrent corrections with different keys only apply once', async () => {
    const d = await detail(p), body = { productId: p.id, sourceMovementId: replacement.id, expectedStockRevision: d.stockRevision, quantity: 11, unitCost: '800', reason: 'Comprobado' };
    const results = await Promise.allSettled([call('correctEntry', 'correct_entry', body), call('correctEntry', 'correct_entry', body)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await detail(p)).physical, '11');
    assert.equal(await prisma.inventoryMovement.count({ where: { sourceMovementId: replacement.id, kind: 'entry_reversal' } }), 1);
  });
  await check('An entry with later sales cannot be replaced even after replenishing', async () => {
    const used = (await create('USED-ENTRY', { initialStock: { quantity: 2 } })).product;
    const m = await sourceFor(used); await sale([line(used)]); await entry(used, 3);
    await rejected(() => correct(used, m, 3), 'ENTRY_ALREADY_USED');
    assert.equal((await detail(used)).physical, '4');
  });
  await check('Only inactive zero-stock unused products can be removed', async () => {
    await rejected(() => remove(p), 'PRODUCT_ACTIVE');
    await deactivate(p); await rejected(() => remove(p), 'PRODUCT_USED');
    const used = (await create('SOLD-REMOVAL', { initialStock: { quantity: 1 } })).product;
    await sale([line(used)]); await deactivate(used); await rejected(() => remove(used), 'PRODUCT_USED');
    const empty = (await create('EMPTY-REMOVAL')).product;
    await deactivate(empty); await rejected(() => remove(empty, undefined, identity, { expectedVersion: 1 }), 'PRODUCT_CHANGED');
    await rejected(() => remove(empty, undefined, vi), 'ACCESS_DENIED');
  });
  await check('Removal replay and recovery use the same fact, while foreign removal is rejected', async () => {
    const empty = (await create('REMOVE-REPLAY')).product; await deactivate(empty);
    const d = await detail(empty), key = randomUUID();
    const body = { productId: empty.id, expectedVersion: d.metadataVersion, expectedStockRevision: d.stockRevision, reason: 'Alta duplicada' };
    await rejected(() => call('catalogue', 'remove_product', body, undefined, { tenantId: other.id, actor: identity.actor }), 'PRODUCT_NOT_FOUND');
    const a = await call('catalogue', 'remove_product', body, key), b = await call('catalogue', 'remove_product', body, key);
    assert.equal(a.operationId, b.operationId); assert(b.replayed);
    assert.equal(await prisma.inventoryOperation.count({ where: { resultProductId: empty.id, kind: 'remove_product' } }), 1);
  });
  await check('Canceling an unused entry permits removal; code/barcode are reusable, facts retained', async () => {
    const discarded = (await create('REUSABLE', { barcode: '0001234500', initialStock: { quantity: 3 } })).product;
    const m = await sourceFor(discarded); await deactivate(discarded);
    const canceled = await correct(discarded, m, 0); assert.equal(canceled.movements.length, 1);
    const key = randomUUID(); const r = await remove(discarded, key);
    assert(r.product.removedAt); assert.equal((await remove(discarded, key).catch(e => e.code)), 'PRODUCT_NOT_FOUND'); // UI cannot reopen a retired record.
    assert.equal((await inv.commands.recover({ ...identity, kind: 'remove_product', operationKey: key })).evidence.removed, true);
    await rejected(() => detail(discarded), 'PRODUCT_NOT_FOUND');
    assert(!(await inv.reads.list({ ...identity, query: { includeInactive: '1', search: 'REUSABLE' } })).data.some(i => i.id === discarded.id));
    const again = (await create('REUSABLE', { barcode: '0001234500' })).product; assert.notEqual(again.id, discarded.id);
    assert.equal(await prisma.inventoryMovement.count({ where: { productId: discarded.id } }), 2);
    await assert.rejects(() => prisma.inventoryProduct.delete({ where: { id: discarded.id } }));
    await assert.rejects(() => prisma.inventoryProduct.update({ where: { id: discarded.id }, data: { removedAt: null } }));
    await rejected(() => entry(discarded, 1), 'PRODUCT_NOT_FOUND');
  });
};
