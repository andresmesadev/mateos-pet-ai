const { randomUUID } = require('node:crypto');
const { InventoryError, fail, integer, cents, amount, text, key, dateOnly, expiryKey, availableLot, allocate, fingerprint, requestKey, productValues, MAX } = require('../../domain/policy');
const { civilDateKey, civilDayBounds } = require('../../../shared/business-day');
const { serviceModule } = require('../../../../services/dashboard-access.service');
const { resolveProductPrice } = require('../../../../services/domain/price-resolver.service');

const KINDS = new Set(['create_product', 'update_product', 'set_product_active', 'register_entry', 'adjust_stock', 'register_consumption', 'correct_consumption', 'confirm_pos_sale', 'return_sale_items']);
const EVENTS = { create_product: 'ProductoRegistrado', update_product: 'ProductoActualizado', set_product_active: 'ProductoActualizado', register_entry: 'EntradaDeInventarioRegistrada', adjust_stock: 'AjusteDeInventarioRegistrado', register_consumption: 'ConsumoDeInventarioRegistrado', correct_consumption: 'ConsumoDeInventarioCorregido', confirm_pos_sale: 'SalidaPorVentaRegistrada', return_sale_items: 'DevolucionDeInventarioRegistrada' };
function buildInventoryCommands({ repository: repo, accessReader, unitOfWork, eventPublisher, clock = () => new Date() }) {
  function requireAdmin(access) { if (!access.capabilities.inventory_manage) fail('ACCESS_DENIED', 'Esta operación requiere administración.', 403); }
  function requireKind(access, kind) {
    if (!KINDS.has(kind)) fail('INVALID_OPERATION', 'Tipo de operación inválido.', 400);
    if (kind === 'confirm_pos_sale') { if (!access.capabilities.cash) fail('ACCESS_DENIED', 'Caja no está habilitada.', 403); }
    else if (kind === 'register_consumption') { if (!access.capabilities.inventory_consume) fail('ACCESS_DENIED', 'No tienes permiso para registrar insumos utilizados.', 403); }
    else requireAdmin(access);
  }
  async function result(operation, access, ctx) {
    requireKind(access, operation.kind);
    if (operation.resultKind === 'sale') {
      const sale = await repo.sale(operation.tenantId, operation.resultSaleId, ctx);
      if (!sale) fail('RESULT_NOT_FOUND', 'Resultado no disponible.', 404);
      if (!access.capabilities.administration) {
        const { start, end } = civilDayBounds(civilDateKey(clock()));
        if (sale.paidAt < start || sale.paidAt >= end) fail('ACCESS_DENIED', 'Esta venta es de otro día. Administración puede consultar el resultado; no la registres otra vez.', 403);
      }
      return { operationId: operation.id, confirmedAt: operation.confirmedAt, transaction: sale };
    }
    if (operation.resultKind === 'product') {
      const product = await repo.findProduct(operation.tenantId, operation.resultProductId, ctx);
      return { operationId: operation.id, evidence: operation.resultEvidence, product };
    }
    const movements = await repo.movements(operation.tenantId, { operationId: operation.id }, ctx);
    if (!access.capabilities.inventory_manage && movements.some(m => m.area !== (access.role === 'vet' ? 'veterinary' : 'grooming'))) fail('ACCESS_DENIED', 'Tu perfil actual no permite consultar el consumo de esa área.', 403);
    // Consumption users can recover their operation without seeing entry costs.
    return { operationId: operation.id, confirmedAt: operation.confirmedAt, evidence: operation.resultEvidence,
      movements: access.capabilities.inventory_manage ? movements : movements.map(({ entryUnitCost: _cost, ...m }) => m) };
  }
  async function recover({ tenantId, actor, kind, operationKey }) {
    return unitOfWork.run(async ctx => {
      const access = await accessReader.readAccess({ tenantId, actor }, ctx);
      requireKind(access, kind);
      const operation = await repo.findOperation({ tenantId, principalKey: access.principalKey, kind, requestKey: requestKey(operationKey) }, ctx);
      if (!operation) fail('OPERATION_NOT_FOUND', 'Todavía no hay un resultado confirmado. Reintenta con la misma clave.', 404);
      return result(operation, access, ctx);
    });
  }
  async function run({ tenantId, actor, kind, operationKey, command }, execute) {
    const reqKey = requestKey(operationKey);
    if (!command || typeof command !== 'object' || Array.isArray(command)) fail('INVALID_COMMAND', 'Datos de operación inválidos.', 400);
    if (command.tenantId !== undefined || command.actor !== undefined || command.principalKey !== undefined) fail('INVALID_IDENTITY', 'La identidad y el establecimiento se obtienen de la sesión.', 400);
    const payloadHash = fingerprint(kind, command);
    let identity;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const committed = await unitOfWork.run(async ctx => {
          const access = await accessReader.readAccess({ tenantId, actor }, ctx);
          requireKind(access, kind);
          identity = { tenantId, principalKey: access.principalKey, kind, requestKey: reqKey };
          const previous = await repo.findOperation(identity, ctx);
          if (previous) {
            if (previous.payloadHash !== payloadHash) fail('OPERATION_CONTENT_CHANGED', 'La clave ya pertenece a otra operación. Revisa el resultado antes de continuar.', 409);
            return { response: await result(previous, access, ctx), replayed: true };
          }
          const now = clock();
          const operation = { id: randomUUID(), ...identity, contractVersion: 1, payloadHash, ...access.snapshot, confirmedAt: now };
          const state = { tenantId, access, now, today: civilDateKey(now), operation, ctx, ordinal: 0, changed: new Set() };
          const evidence = await execute(state);
          for (const productId of state.changed) await repo.bumpStock(tenantId, productId, ctx);
          return { response: await result({ ...operation, ...evidence }, access, ctx), replayed: false, publishesStockEvent: kind !== 'confirm_pos_sale' || state.changed.size > 0 };
        }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 });
        if (!committed.replayed && committed.publishesStockEvent) await eventPublisher?.publish(EVENTS[kind], { tenantId, operationId: committed.response.operationId, kind });
        return { ...committed.response, replayed: committed.replayed };
      } catch (error) {
        const unique = error.code === 'P2002' && (String(error.meta?.target).includes('requestKey') || String(error.meta?.constraint).includes('InventoryOperation_request_key'));
        const pgCode = error.meta?.code ?? error.meta?.driverAdapterError?.cause?.originalCode;
        const serializableConflict = error.code === 'P2034' || (error.code === 'P2010' && ['40001', '40P01'].includes(pgCode));
        if (serializableConflict || unique) { if (attempt < 2) continue; fail('OPERATION_BUSY', 'La operación sigue en disputa. Consulta su resultado y reintenta con la misma clave.', 409); }
        if (error.code === 'P2002') fail('DUPLICATE_CODE', 'Ese código, lote o devolución ya está registrado. Actualiza y revisa.', 409);
        throw error;
      }
    }
  }
  async function start(state, resultKind, refs = {}) {
    const evidence = { resultKind, ...refs };
    await repo.createOperation({ ...state.operation, ...evidence }, state.ctx);
    return evidence;
  }
  async function product(state, id, active = false) {
    const p = await repo.findProduct(state.tenantId, id, state.ctx);
    if (!p) fail('PRODUCT_NOT_FOUND', 'Producto no encontrado.', 404);
    if (active && !p.active) fail('PRODUCT_INACTIVE', 'El producto está desactivado.', 409);
    return p;
  }
  async function move(state, p, lot, kind, quantity, delta, extra = {}) {
    const after = lot.balancePhysical + delta;
    integer(after, 'Saldo resultante', true);
    if (delta) { await repo.changeBalance(state.tenantId, lot, delta, state.ctx); state.changed.add(p.id); }
    await repo.recordMovement({ id: randomUUID(), tenantId: state.tenantId, operationId: state.operation.id, productId: p.id, lotId: lot.id,
      ordinal: ++state.ordinal, kind, quantity, stockDelta: delta, balanceBefore: lot.balancePhysical, balanceAfter: after,
      occurredAt: state.now, ...state.access.snapshot, productNameSnapshot: p.name, productCodeSnapshot: p.internalCode,
      presentationSnapshot: p.presentation, lotCodeSnapshot: lot.commercialCode, expiresOnSnapshot: lot.expiresOn, ...extra }, state.ctx);
    lot.balancePhysical = after;
  }
  async function addEntry(state, p, command) {
    const quantity = integer(command.quantity, 'Cantidad');
    const entryUnitCost = amount(cents(command.unitCost, 'Costo unitario', true));
    let commercialCode = null, commercialKey = null, expiresOn = null;
    if (p.lotPolicy !== 'untracked') { commercialCode = text(command.lotCode, 'Lote', 80); commercialKey = key(commercialCode); }
    else if (command.lotCode || command.expiresOn) fail('INVALID_LOT', 'Este producto se controla sin lote.', 400);
    if (p.lotPolicy === 'lot_expiry') {
      const date = dateOnly(command.expiresOn);
      if (date <= state.today) fail('LOT_EXPIRED', 'No registres una entrada ordinaria de mercancía vencida. Usa un ajuste administrativo.', 409);
      expiresOn = new Date(date + 'T00:00:00Z');
    } else if (command.expiresOn) fail('INVALID_LOT', 'Este producto no usa fecha de vencimiento.', 400);
    const lots = await repo.lots(state.tenantId, p.id, state.ctx);
    let lot = lots.find(l => commercialKey ? l.commercialKey === commercialKey : l.groupKind === 'untracked');
    if (lot && expiryKey(lot) !== (expiresOn?.toISOString().slice(0, 10) ?? null)) fail('LOT_DATE_CHANGED', 'El lote ya existe con otro vencimiento. Conserva su fecha original.', 409);
    if (!lot) lot = await repo.createLot({ id: randomUUID(), tenantId: state.tenantId, productId: p.id, groupKind: commercialKey ? 'commercial' : 'untracked', commercialCode, commercialKey, expiresOn, firstReceivedAt: state.now }, state.ctx);
    await move(state, p, lot, 'entry', quantity, quantity, { entryUnitCost, reason: text(command.reason, 'Nota', 1000, true) });
  }
  async function catalogue(input) {
    return run(input, async state => {
      const command = input.command;
      if (input.kind === 'create_product') {
        const values = productValues(command);
        if (values.uses.some(u => !state.access.activeModules.includes(u))) fail('MODULE_DISABLED', 'Activa las áreas seleccionadas antes de crear el producto.', 403);
        const id = randomUUID();
        const evidence = await start(state, 'product', { resultProductId: id, resultEvidence: { metadataVersion: 1, priceVersion: 1 } });
        await repo.createProduct({ id, tenantId: state.tenantId, ...values }, state.ctx);
        return evidence;
      }
      await repo.lockProducts(state.tenantId, [command.productId], state.ctx);
      const p = await product(state, command.productId);
      if (integer(command.expectedVersion, 'Versión') !== p.metadataVersion) fail('PRODUCT_CHANGED', 'Otra persona modificó este producto. Actualiza antes de guardar.', 409);
      const values = input.kind === 'set_product_active' ? {} : productValues({ ...p, referenceCost: String(p.referenceCost), salePrice: p.salePrice == null ? null : String(p.salePrice), ...command });
      if (typeof command.active !== 'undefined' && typeof command.active !== 'boolean') fail('INVALID_STATE', 'Estado inválido.', 400);
      if (values.uses?.some(u => !p.uses.includes(u) && !state.access.activeModules.includes(u))) fail('MODULE_DISABLED', 'No puedes añadir un uso de un área desactivada.', 403);
      if ((values.presentation && values.presentation !== p.presentation) || (values.lotPolicy && values.lotPolicy !== p.lotPolicy)) {
        if ((await repo.movements(state.tenantId, { productId: p.id }, state.ctx)).length) fail('PRODUCT_POLICY_USED', 'La presentación y el control de lotes no cambian después de registrar movimientos.', 409);
      }
      const priceChanged = values.salePrice !== undefined && String(values.salePrice ?? '') !== (p.salePrice == null ? '' : Number(p.salePrice).toFixed(2));
      if (p.metadataVersion >= MAX || (priceChanged && p.priceVersion >= MAX)) fail('VERSION_LIMIT', 'El producto alcanzó el límite de versiones. Consulta a administración.', 409);
      const evidence = await start(state, 'product', { resultProductId: p.id, resultEvidence: { metadataVersion: p.metadataVersion + 1, priceVersion: p.priceVersion + (priceChanged ? 1 : 0) } });
      await repo.updateProduct(state.tenantId, p.id, { ...values, ...(command.active === undefined ? {} : { active: command.active }), metadataVersion: { increment: 1 }, ...(priceChanged ? { priceVersion: { increment: 1 } } : {}) }, state.ctx);
      return evidence;
    });
  }
  async function entry(input) {
    return run(input, async state => {
      await repo.lockProducts(state.tenantId, [input.command.productId], state.ctx);
      const p = await product(state, input.command.productId, true);
      const evidence = await start(state, 'movements');
      await addEntry(state, p, input.command);
      return evidence;
    });
  }
  async function adjust(input) {
    return run(input, async state => {
      const c = input.command;
      await repo.lockProducts(state.tenantId, [c.productId], state.ctx);
      const p = await product(state, c.productId);
      const reason = text(c.reason, 'Motivo', 1000);
      if (integer(c.expectedStockRevision, 'Revisión de existencias', true) !== p.stockRevision) fail('STOCK_COUNT_CHANGED', 'Las existencias cambiaron desde el conteo. Actualiza y vuelve a contar.', 409);
      const lot = await repo.findLot(state.tenantId, p.id, c.lotId, state.ctx);
      if (!lot) fail('LOT_NOT_FOUND', 'Lote no encontrado. Para ingresar un lote nuevo registra una entrada.', 404);
      const count = integer(c.countedQuantity, 'Cantidad contada', true), difference = count - lot.balancePhysical;
      const evidence = await start(state, 'movements', { resultEvidence: { productId: p.id, lotId: lot.id, countedQuantity: count, expectedStockRevision: p.stockRevision, difference } });
      if (difference) await move(state, p, lot, difference > 0 ? 'adjustment_in' : 'adjustment_out', Math.abs(difference), difference, { reason, countedQuantity: count, expectedStockRevision: p.stockRevision });
      return evidence;
    });
  }
  async function consume(input) {
    return run(input, async state => {
      const c = input.command, area = c.area;
      if (!['veterinary', 'grooming'].includes(area) || !state.access.activeModules.includes(area) ||
        (!state.access.capabilities.administration && area !== (state.access.role === 'vet' ? 'veterinary' : 'grooming'))) fail('ACCESS_DENIED', 'No tienes acceso al consumo de esta área.', 403);
      const reason = text(c.reason, 'Motivo', 1000, Boolean(c.appointmentId));
      if (c.appointmentId) {
        const attention = await repo.attention(state.tenantId, c.appointmentId, state.ctx);
        if (!attention || serviceModule(attention) !== area) fail('ATTENTION_NOT_FOUND', 'Atención no encontrada para esa área.', 404);
        if (!['in_progress', 'completed'].includes(attention.status)) fail('ATTENTION_NOT_STARTED', 'Inicia la atención antes de registrar insumos.', 409);
        if (!state.access.capabilities.administration && attention.staffId !== state.access.staffId) fail('ACCESS_DENIED', 'La atención está asignada a otro profesional.', 403);
      }
      if (!Array.isArray(c.items) || !c.items.length || c.items.length > 100 || c.items.some(i => !i || typeof i !== 'object')) fail('INVALID_ITEMS', 'Selecciona entre 1 y 100 productos.', 400);
      await repo.lockProducts(state.tenantId, c.items.map(i => i.productId), state.ctx);
      const evidence = await start(state, 'movements');
      for (const item of c.items) {
        const p = await product(state, item.productId, true);
        if (!p.uses.includes(area)) fail('INVALID_PRODUCT_USE', `${p.name} no está destinado a esta área.`, 409);
        const assignments = allocate(await repo.lots(state.tenantId, p.id, state.ctx), integer(item.quantity, 'Cantidad'), state.today);
        for (const a of assignments) await move(state, p, a.lot, 'consumption', a.quantity, -a.quantity, { area, reason, appointmentId: c.appointmentId ?? null });
      }
      return evidence;
    });
  }
  async function correct(input) {
    return run(input, async state => {
      const c = input.command, reason = text(c.reason, 'Motivo', 1000);
      const sources = await repo.movements(state.tenantId, { operationId: c.sourceOperationId, kind: 'consumption' }, state.ctx);
      if (!sources.length) fail('CONSUMPTION_NOT_FOUND', 'Consumo no encontrado.', 404);
      const source = sources.find(m => m.id === c.sourceMovementId);
      if (!source) fail('CONSUMPTION_NOT_FOUND', 'Movimiento de consumo no encontrado.', 404);
      await repo.lockProducts(state.tenantId, [source.productId], state.ctx);
      const quantity = integer(c.quantity, 'Unidades a corregir');
      if (quantity + await repo.compensatedQuantity(state.tenantId, source.id, state.ctx) > source.quantity) fail('CORRECTION_EXCEEDS_SOURCE', 'La corrección supera las unidades consumidas que faltan por compensar.', 409);
      const p = await product(state, source.productId), lot = await repo.findLot(state.tenantId, p.id, source.lotId, state.ctx);
      const evidence = await start(state, 'movements', { sourceOperationId: c.sourceOperationId });
      await move(state, p, lot, 'consumption_correction', quantity, quantity, { sourceMovementId: source.id, reason, area: source.area, appointmentId: source.appointmentId });
      return evidence;
    });
  }
  async function returnItems(input) {
    return run(input, async state => {
      const c = input.command;
      await repo.lockSale(state.tenantId, c.transactionId, state.ctx);
      const sale = await repo.sale(state.tenantId, c.transactionId, state.ctx);
      if (!sale) fail('SALE_NOT_FOUND', 'Venta no encontrada.', 404);
      if (sale.origin !== 'manual_pos_sale' || sale.status !== 'voided') fail('SALE_NOT_VOIDED', 'Primero anula la venta manual. La devolución registra mercancía, no realiza un reembolso bancario.', 409);
      const reason = text(c.reason, 'Motivo', 1000);
      if (!Array.isArray(c.items) || !c.items.length || c.items.length > 100 || c.items.some(i => !i || typeof i !== 'object') || new Set(c.items.map(i => i.transactionItemId)).size !== c.items.length) fail('INVALID_ITEMS', 'Selecciona líneas diferentes de la venta.', 400);
      const targets = c.items.map(i => ({ command: i, item: sale.items.find(line => line.id === i.transactionItemId && line.productId) }));
      if (targets.some(t => !t.item)) fail('INVALID_RETURN_ITEM', 'Solo se devuelve por inventario una línea catalogada de esta venta.', 422);
      await repo.lockProducts(state.tenantId, targets.map(t => t.item.productId), state.ctx);
      const evidence = await start(state, 'returns');
      for (const { item, command } of targets) {
        if (item.inventoryReturn) fail('ITEM_ALREADY_RETURNED', 'Esta línea ya tiene una devolución registrada.', 409);
        if (!['restock', 'discard'].includes(command.disposition)) fail('INVALID_DISPOSITION', 'Selecciona si la mercancía está apta o debe retirarse.', 400);
        const sources = await repo.movements(state.tenantId, { transactionItemId: item.id, transactionId: sale.id, kind: 'sale' }, state.ctx);
        if (sources.reduce((sum, m) => sum + m.quantity, 0) !== item.quantity) fail('INCOMPLETE_ASSIGNMENTS', 'La línea no tiene asignaciones de inventario completas.', 409);
        const marker = await repo.createReturn({ id: randomUUID(), tenantId: state.tenantId, operationId: state.operation.id, transactionId: sale.id, transactionItemId: item.id, productId: item.productId, quantity: item.quantity, disposition: command.disposition, reason, recordedAt: state.now }, state.ctx);
        const p = await product(state, item.productId);
        for (const source of sources) {
          const lot = await repo.findLot(state.tenantId, p.id, source.lotId, state.ctx);
          if (command.disposition === 'restock' && !availableLot(lot, state.today)) fail('LOT_EXPIRED', 'La mercancía vencida debe registrarse como no apta, sin reponer existencias.', 409);
          const restock = command.disposition === 'restock';
          await move(state, p, lot, restock ? 'return_restock' : 'return_discard', source.quantity, restock ? source.quantity : 0,
            { transactionId: sale.id, transactionItemId: item.id, sourceMovementId: source.id, returnLineId: marker.id, reason });
        }
      }
      return evidence;
    });
  }
  async function prepareSale(state, lines) {
    await repo.lockProducts(state.tenantId, lines.filter(i => i.productId).map(i => i.productId), state.ctx);
    const prepared = [];
    const required = new Map();
    for (const line of lines) {
      if (!line.productId) { prepared.push(line); continue; }
      const p = await product(state, line.productId, true);
      if (!state.access.capabilities.retail || !p.uses.includes('retail')) fail('ACCESS_DENIED', 'Ese producto no está habilitado para venta.', 403);
      const resolution = resolveProductPrice({ productBasePrice: p.salePrice });
      if (resolution.finalPrice == null || p.priceVersion !== line.priceVersion || cents(line.unitPrice) !== cents(resolution.finalPrice)) fail('PRICE_CHANGED', `${p.name}: el precio cambió. Actualiza el producto y revisa la venta antes de confirmar.`, 409);
      required.set(p.id, (required.get(p.id) ?? 0) + integer(line.quantity, 'Cantidad'));
      if (required.get(p.id) > MAX) fail('INVALID_QUANTITY', 'La cantidad total del producto supera el límite.', 400);
      prepared.push({ ...line, description: p.name, itemKind: 'product', unitPrice: amount(cents(resolution.finalPrice)), product: p });
    }
    for (const [id, quantity] of required) allocate(await repo.lots(state.tenantId, id, state.ctx), quantity, state.today);
    return prepared;
  }
  async function sellLines(state, items) {
    for (const item of items.filter(i => i.productId)) {
      const p = await product(state, item.productId);
      for (const a of allocate(await repo.lots(state.tenantId, p.id, state.ctx), item.quantity, state.today))
        await move(state, p, a.lot, 'sale', a.quantity, -a.quantity, { transactionId: item.transactionId, transactionItemId: item.id });
    }
  }
  return { run, recover, start, catalogue, entry, adjust, consume, correct, returnItems, prepareSale, sellLines, requireKind, result };
}
module.exports = { buildInventoryCommands, KINDS, InventoryError };
