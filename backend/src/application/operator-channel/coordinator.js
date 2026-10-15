const { randomUUID } = require('node:crypto');
const p = require('./protocol');
const { fail, json, productContext } = require('../../contexts/agents/application/operational/policy');
const { projection } = require('./access');
const { fits } = require('./message-limits');
const LABELS = { amount: 'Importe', category: 'Categoría', responsible: 'Responsable', date: 'Fecha', description: 'Descripción', paymentMethod: 'Forma de pago', notes: 'Notas',
  productId: 'Referencia de producto', productName: 'Producto', presentation: 'Presentación', quantity: 'Cantidad', unitCost: 'Costo unitario', lotCode: 'Lote', expiresOn: 'Vencimiento', reason: 'Motivo',
  totalIncome: 'Ingresos', totalExpenses: 'Gastos', netIncome: 'Resultado', balance: 'Saldo', name: 'Nombre', stock: 'Existencias', currentStock: 'Existencias', availableStock: 'Disponible',
  referenceCost: 'Costo de referencia', salePrice: 'Precio de venta', stockMinimum: 'Mínimo', available: 'Disponible', internalCode: 'Código', observedAt: 'Consultado', state: 'Estado', total: 'Total', data: 'Resultados', nextCursor: 'Más resultados en el dashboard' };
function lines(value, depth = 0) {
  if (value === null || value === undefined) return 'Sin dato';
  if (typeof value !== 'object') return String(value);
  if (depth > 5) return JSON.stringify(value);
  if (Array.isArray(value)) return value.map((v,i) => `${i + 1}. ${lines(v,depth+1)}`).join('\n');
  return Object.entries(value).filter(([k]) => !['accessHash','publication','payloadHash','principalKey','tenantId'].includes(k)).map(([k,v]) => `${LABELS[k] || k}: ${lines(v,depth+1)}`).join('\n');
}
function queryText(result) {
  if (result.intent !== 'inventory_search') return `Consulta realizada: ${result.observedAt}\n${lines(result.data)}`;
  // A search is a labelled summary, not an operation preview. Keep full names
  // and references; never serialize opaque cursors into the button body.
  const products = (result.data.data || []).map(product => ({ name: product.name, presentation: product.presentation,
    internalCode: product.internalCode || product.id, available: product.available,
    ...(product.salePrice !== undefined ? { salePrice: product.salePrice } : {}),
    ...(product.referenceCost !== undefined ? { referenceCost: product.referenceCost } : {}) }));
  return `Productos · resultados resumidos · ${result.observedAt}\n${products.length ? lines(products) : 'Sin resultados.'}\nPide el detalle de un producto para ver sus demás datos.`;
}
function buildOperatorCoordinator({ prisma, operational, access, authority, delivery, interpret, clock = () => new Date() }) {
  const run = (input, fn) => operational.store.run(fn, input);
  async function work(input, job, kind, target = {}) {
    return run(input, async ctx => {
      const a = await access.check(input, ctx);
      const previous = await ctx.tx.operatorInboundWork.findUnique({ where: { jobId_stepKey: { jobId: job.id, stepKey: 'primary' } } });
      if (previous) return previous;
      return ctx.tx.operatorInboundWork.create({ data: { id: randomUUID(), tenantId: job.channelTenantId, principalKey: a.subject.principalKey, subjectId: a.subject.id,
        sessionId: a.session.id, jobId: job.id, stepKey: 'primary', kind, inputHash: job.channelInputHash,
        ...(kind === 'request' ? { requestKey: randomUUID() } : target), state: 'reserved', createdAt: clock() } });
    });
  }
  async function display(input, job, { text, result = {}, action, accessClass = 'private_generic' }) {
    return run(input, async ctx => {
      const a = await access.check(input, ctx);
      const prior = await ctx.tx.operatorDelivery.findUnique({ where: { sourceJobId_replyOrdinal: { sourceJobId: job.id, replyOrdinal: 0 } } });
      if (prior) return [{ deliveryId: prior.id }];
      // Keep the recoverable proposal selected even when its complete preview
      // must be reviewed in the dashboard instead of this channel.
      if (action) await ctx.tx.operatorThread.update({ where: { id: a.session.threadId }, data: { selectedActionId: action.id, version: { increment: 1 } } });
      let products = [], selected;
      const query = result.result?.kind === 'query' && ['inventory_search','inventory_movements'].includes(result.result.intent);
      if (query) {
        const thread = await ctx.tx.operatorThread.findUnique({ where: { id: a.session.threadId } });
        selected = thread.selectedActionId ? await operational.store.action({ tenantId: job.channelTenantId, principalKey: a.subject.principalKey }, thread.selectedActionId, ctx) : null;
        if (a.access.capabilities.inventory_manage && selected?.kind === 'entrada_inventario' && ['borrador','lista'].includes(selected.state) && !selected.receipts.length && result.result.intent === 'inventory_search') {
          products = (result.result.data.data || []).slice(0,2).map((product, index) => ({ product, ordinal: index+1 })).filter(({ product }) => product.active);
        }
      }
      const interactive = !!(products.length || (query && result.result.data.nextCursor) || (action?.state === 'lista' && !action.receipt));
      if (!fits(text, interactive)) {
        const d = await delivery.prepare(ctx.tx, job, { controlCode: 'use_dashboard' });
        return [{ deliveryId: d.id }];
      }
      const accessProjection = json(projection(a.access));
      const message = await ctx.tx.operatorMessage.create({ data: { id: randomUUID(), tenantId: job.channelTenantId, principalKey: a.subject.principalKey, threadId: a.session.threadId,
        sessionId: a.session.id, direction: 'out', actorKind: 'agent', actorName: 'Equipo digital', content: json({ text, result }), accessClass, accessProjection,
        permissionEpoch: a.subject.permissionEpoch, tenantAccessEpoch: a.tenant.operatorAccessEpoch, createdAt: clock() } });
      async function offer(kind, target) {
        const id = randomUUID(); const token = `op1.${p.mac(authority.settings.key, 'outgoing-button', id)}`;
        return ctx.tx.operatorInteraction.create({ data: { id, tenantId: job.channelTenantId, principalKey: a.subject.principalKey, sessionId: a.session.id, messageId: message.id,
          kind, ...target, tokenDigest: p.mac(authority.settings.key, 'interaction-token', token), keyVersion: authority.settings.keyVersion,
          modeVersion: a.participant.modeVersion, routeVersion: a.route.version, permissionEpoch: a.subject.permissionEpoch, tenantAccessEpoch: a.tenant.operatorAccessEpoch,
          state: 'prepared', expiresAt: new Date(Math.min(+a.session.idleExpiresAt,+a.session.absoluteExpiresAt,+clock()+900000)), createdAt: clock() } });
      }
      if (query) {
        const thread = await ctx.tx.operatorThread.findUnique({ where: { id: a.session.threadId } });
        for (const { product, ordinal } of products) await offer('select_product', { actionId: selected.id, expectedRevision: selected.currentRevision, productId: product.id,
          selectionContext: { ordinal, productContext: productContext(product) } });
        if (result.result.data.nextCursor) await offer('continue', { selectionContext: { employeeId: thread.selectedEmployeeId, intent: result.result.intent,
          fields: { ...result.result.parameters, cursor: result.result.data.nextCursor } } });
      }
      if (action) {
        const row = await operational.store.action({ tenantId: job.channelTenantId, principalKey: a.subject.principalKey }, action.id, ctx, true);
        if (row.currentRevision !== action.revision) fail('REVISION_CHANGED', 'La propuesta cambió. Solicita su estado otra vez.', 409);
        if (action.state === 'lista' && !action.receipt) {
          let basis = await ctx.tx.operatorReview.findFirst({ where: { actionId: action.id, revision: action.revision, kind: 'basis' } });
          if (!basis) basis = await ctx.tx.operatorReview.create({ data: { id: randomUUID(), tenantId: job.channelTenantId, principalKey: a.subject.principalKey, subjectId: a.subject.id,
            kind: 'basis', actionId: action.id, revision: action.revision, payloadHash: row.current.payloadHash, previewHash: p.digest(action.preview), permissionEpoch: a.subject.permissionEpoch,
            tenantAccessEpoch: a.tenant.operatorAccessEpoch, createdAt: clock() } });
          if (basis.permissionEpoch !== a.subject.permissionEpoch || basis.tenantAccessEpoch !== a.tenant.operatorAccessEpoch) fail('REVIEW_ACCESS_CHANGED', 'Actualiza explícitamente la propuesta para revisarla con tus permisos actuales.', 409);
          const expiresAt = new Date(Math.min(+a.session.idleExpiresAt,+a.session.absoluteExpiresAt,+row.current.expiresAt));
          if (expiresAt <= clock()) fail('PROPOSAL_EXPIRED', 'Actualiza explícitamente la propuesta.', 410);
          const review = await ctx.tx.operatorReview.create({ data: { id: randomUUID(), tenantId: job.channelTenantId, principalKey: a.subject.principalKey, subjectId: a.subject.id,
            kind: 'display', basisId: basis.id, actionId: action.id, revision: action.revision, sessionId: a.session.id, messageId: message.id, payloadHash: row.current.payloadHash,
            previewHash: p.digest(action.preview), permissionEpoch: a.subject.permissionEpoch, tenantAccessEpoch: a.tenant.operatorAccessEpoch, createdAt: clock(), expiresAt } });
          const id = randomUUID(); const token = `op1.${p.mac(authority.settings.key, 'outgoing-button', id)}`;
          await ctx.tx.operatorInteraction.create({ data: { id, tenantId: job.channelTenantId, principalKey: a.subject.principalKey, sessionId: a.session.id, messageId: message.id,
            reviewId: review.id, kind: 'confirm', actionId: action.id, expectedRevision: action.revision, tokenDigest: p.mac(authority.settings.key, 'interaction-token', token), keyVersion: authority.settings.keyVersion,
            modeVersion: a.participant.modeVersion, routeVersion: a.route.version, permissionEpoch: a.subject.permissionEpoch, tenantAccessEpoch: a.tenant.operatorAccessEpoch,
            state: 'prepared', expiresAt, createdAt: clock() } });
        }
      }
      const d = await delivery.prepare(ctx.tx, job, { message }); return [{ deliveryId: d.id }];
    });
  }
  async function control(job, code) {
    return prisma.$transaction(async tx => { const d = await delivery.prepare(tx, job, { controlCode: code }); return [{ deliveryId: d.id }]; });
  }
  const actionText = a => a.receipt ? `Operación registrada. Recibo: ${a.receipt.id}\n${lines(a.receipt.result)}` :
    `Propuesta · revisión ${a.revision}\n${lines(a.preview)}\n${a.missingFields.length ? 'Faltan: ' + a.missingFields.map(k=>LABELS[k]||k).join(', ') : 'Revisa todos los datos y usa el botón para confirmar.'}\nEstado: ${a.state}${a.expiresAt ? '\nVence: ' + a.expiresAt : ''}\nPara corregir escribe «corregir» y los cambios. Para actualizar una propuesta vencida: /actualizar. Para descartarla: /descartar.`;
  async function process(job) {
    if (job.channelResultKind === 'blocked') return [];
    if (job.channelResultKind === 'control') return control(job, job.replies?.[0]?.controlCode || 'access_denied');
    if (job.channelResultKind !== 'operator') fail('INVALID_OPERATOR_JOB', 'Mensaje no privado.', 409);
    let input = access.forJob(await access.identity(job.channelSessionId), job);
    const initial = await run(input, async ctx => {
      const a = await access.check(input, ctx);
      const thread = await ctx.tx.operatorThread.findUnique({ where: { id: a.session.threadId } });
      const existing = await ctx.tx.operatorMessage.findUnique({ where: { incomingJobId: job.id } });
      if (!existing) await ctx.tx.operatorMessage.create({ data: { id: randomUUID(), tenantId: job.channelTenantId, principalKey: a.subject.principalKey, threadId: thread.id, sessionId: a.session.id,
        incomingJobId: job.id, direction: 'in', actorKind: 'operator', actorName: a.access.snapshot.actorName, content: { kind: job.payload.kind, ...(job.payload.text ? { text: job.payload.text } : {}) },
        accessClass: 'private_generic', accessProjection: json(projection(a.access)),
        permissionEpoch: a.subject.permissionEpoch, tenantAccessEpoch: a.tenant.operatorAccessEpoch, createdAt: clock() } });
      return { thread, access: a.access };
    });
    if (job.payload.kind === 'negocio') return display(input, job, { text: 'Modo negocio activado. Escribe «finanzas» o «inventario» para elegir tu empleado.\nCada gasto o entrada requiere tu revisión y confirmación.\n/estado recupera la última propuesta. /clientes vuelve a la atención al cliente.' });
    if (job.payload.kind === 'unsupported') return control(job, 'use_text');
    const text = job.payload.text?.trim() || '';
    const choice = /^(?:\/)?(finanzas|financiero|inventario|administración)$/i.exec(text);
    if (choice) {
      const specialization = /finanza|financiero/i.test(choice[1]) ? 'asistente_financiero' : 'asistente_administrativo';
      const available = await operational.list(input); const selected = available.data.find(e => e.specialization === specialization && e.status === 'activo');
      if (!selected) return display(input, job, { text: 'Ese empleado no está disponible para tu acceso actual. Revísalo en el dashboard.' });
      await run(input, async ctx => { const a = await access.check(input, ctx); await ctx.tx.operatorThread.update({ where: { id: a.session.threadId }, data: { selectedEmployeeId: selected.id, selectedActionId: null, version: { increment: 1 } } }); });
      return display(input, job, { text: specialization === 'asistente_financiero' ? 'Financiero listo. Puedes consultar reportes o preparar un gasto indicando importe, descripción y responsable.' : 'Inventario listo. Puedes buscar productos, consultar detalles y movimientos o preparar una entrada.' });
    }
    let actionId = initial.thread.selectedActionId;
    const adopt = /^\/propuesta\s+([a-zA-Z0-9-]{1,100})$/.exec(text);
    if (adopt) actionId = adopt[1];
    let action = actionId ? await operational.getAction(input, actionId) : null;
    let result;
    if (text === '/estado' && !action && initial.thread.taskContext?.taskId) {
      result = await operational.getTask(input, initial.thread.taskContext.taskId);
      return display(input, job, { text: result.action ? actionText(result.action) : `Estado de tu atención: ${result.state}\n${lines(result.result.data || result.result.message || 'Consulta la atención desde el dashboard.')}`,
        result, action: result.action, accessClass: result.result.intent === 'inventory_movements' ? 'inventory_manage' : result.result.intent?.startsWith('inventory_') ? 'inventory_read' : 'finance' });
    }
    if (job.payload.kind === 'interaction') {
      if (!job.payload.contextId || job.payload.forwarded || !job.payload.tokenDigest) return control(job, 'use_dashboard');
      const i = await prisma.operatorInteraction.findUnique({ where: { tokenDigest: job.payload.tokenDigest } });
      if (!i || !['confirm','select_product','continue'].includes(i.kind) || i.sessionId !== job.channelSessionId || i.principalKey !== job.channelPrincipalKey || i.providerMessageId !== job.payload.contextId || !['offered','consumed'].includes(i.state)) return control(job, 'use_dashboard');
      if (i.kind === 'continue') {
        if (i.state === 'consumed' && i.resultReference?.taskId) result = await operational.getTask(input, i.resultReference.taskId);
        else {
          const w = await work(input, job, 'request');
          input = access.withChoice(access.forJob(input, job, w.state === 'reserved' ? w.id : undefined), i.id, job.payload.contextId, job.payload.tokenDigest, 'prepare');
          result = await operational.request(input, i.selectionContext.employeeId, { requestId: w.requestKey, intent: i.selectionContext.intent, fields: i.selectionContext.fields });
        }
        action = result.action;
      } else if (i.kind === 'select_product') {
        if (i.state === 'consumed') action = await operational.getAction(input, i.actionId);
        else {
          const w = await work(input, job, 'select', { actionId: i.actionId, expectedRevision: i.expectedRevision });
          input = access.withChoice(access.forJob(input, job, w.state === 'reserved' ? w.id : undefined), i.id, job.payload.contextId, job.payload.tokenDigest);
          action = w.state === 'resolved' ? await operational.getAction(input, i.actionId) : await operational.revise(input, i.actionId, i.expectedRevision, { productId: i.productId });
        }
      } else {
        const w = await work(input, job, 'confirm', { actionId: i.actionId, expectedRevision: i.expectedRevision });
        input = access.withInteraction(access.forJob(input, job, w.state === 'reserved' ? w.id : undefined), i.id, job.payload.contextId, job.payload.tokenDigest);
        action = w.state === 'resolved' ? await operational.getAction(input, i.actionId) : await operational.confirm(input, i.actionId, i.expectedRevision);
      }
    } else if (action && (/^\/(estado|actualizar|descartar)$/.test(text) || adopt || /^corregir\b/i.test(text))) {
      if (text === '/estado' || adopt) { /* fresh authorized snapshot */ }
      else {
        const kind = text === '/actualizar' ? 'refresh' : text === '/descartar' ? 'discard' : 'revise';
        const w = await work(input, job, kind, { actionId: action.id, expectedRevision: action.revision });
        input = access.forJob(input, job, w.state === 'reserved' ? w.id : undefined);
        if (w.state === 'resolved') action = await operational.getAction(input, action.id);
        else if (kind === 'refresh') action = await operational.refresh(input, action.id, w.expectedRevision);
        else if (kind === 'discard') action = await operational.discard(input, action.id, w.expectedRevision);
        else {
          let patch;
          try { patch = JSON.parse(text.replace(/^corregir\s*/i,'')); } catch {
            const extracted = await interpret(`Corrige únicamente estos datos de la propuesta ${JSON.stringify(action.preview)}. Cambios solicitados: ${text}`, action.kind === 'registrar_gasto' ? 'asistente_financiero' : 'asistente_administrativo');
            const expected = action.kind === 'registrar_gasto' ? 'prepare_expense' : 'prepare_entry';
            if (!extracted || extracted.intent !== expected) return display(input, job, { text: 'Indica los datos que deseas corregir o edita la propuesta en el dashboard.' }); patch = extracted.fields;
          }
          action = await operational.revise(input, action.id, w.expectedRevision, patch);
        }
      }
    } else {
      if (/^(sí|si|confirmar|confirmo|aceptar|ok)$/i.test(text)) return display(input, job, { text: 'Para registrar la operación usa el botón de la vista previa. Si no aparece, confirma desde el dashboard.' });
      if (!initial.thread.selectedEmployeeId) return display(input, job, { text: 'Elige primero «finanzas» o «inventario».' });
      const w = await work(input, job, 'request');
      input = access.forJob(input, job, w.state === 'reserved' ? w.id : undefined);
      result = await operational.request(input, initial.thread.selectedEmployeeId, { requestId: w.requestKey, text });
      if (['resuelta','requiere_revision'].includes(result.state)) await run(input, async ctx => { await access.check(input, ctx); await ctx.tx.operatorInboundWork.updateMany({ where: { id: w.id, state: 'reserved' }, data: {
        state: 'resolved', resolvedAt: clock(), result: { taskId: result.taskId }, operationalRequestId: (await ctx.tx.operationalRequest.findFirst({ where: { tenantId: job.channelTenantId, principalKey: job.channelPrincipalKey, requestId: w.requestKey } })).id } }); });
      action = result.action;
    }
    const selected = initial.thread.selectedEmployeeId ? await prisma.digitalEmployee.findUnique({ where: { id: initial.thread.selectedEmployeeId } }) : null;
    const accessClass = action ? (action.kind === 'registrar_gasto' ? 'finance' : 'inventory_manage') : result?.result?.intent === 'inventory_movements' ? 'inventory_manage' : selected?.specialization === 'asistente_financiero' ? 'finance' : 'inventory_read';
    return display(input, job, { text: action ? actionText(action) : result?.result?.kind === 'query' ? queryText(result.result) : result?.result?.message || 'Consulta en proceso. Revisa la atención en el dashboard.', result: result || {}, action, accessClass });
  }
  return { process, display, control };
}
module.exports = { buildOperatorCoordinator, lines, queryText };
