const { randomUUID } = require('node:crypto');
const { fail, uuid, keys, hash, json, limitedResult, text, intentInput, authorize, normalizeCommand, productContext, SPECIALIZATIONS } = require('./policy');
const intentFor = kind => kind === 'registrar_gasto' ? 'prepare_expense' : 'prepare_entry';
const accessHash = access => hash([access.role, access.activeModules, access.capabilities]);
function buildOperationalAttention({ store, finance, inventory, interpret, read }) {
  const now = store.clock;
  const run = (input, fn) => store.run(fn, input);
  function permitted(access, employee) { return (SPECIALIZATIONS[employee.specialization] || []).filter(intent => { try { authorize(access, employee.specialization, intent); return true; } catch { return false; } }); }
  function checkAction(access, row) { authorize(access, row.request.employee.specialization, intentFor(row.kind)); }
  function actionDTO(row) {
    const receipt = row.receipts[0];
    return json({ id: row.id, taskId: row.taskId, kind: row.kind, state: row.state === 'lista' && row.current.expiresAt <= now() ? 'vencida' : row.state,
      revision: row.currentRevision, preview: row.current.preview, payload: row.current.payload, missingFields: row.current.missingFields,
      expiresAt: row.current.expiresAt, receipt: receipt ? { id: receipt.id, confirmedAt: receipt.confirmedAt, result: receipt.result } : null, publication: row.publication });
  }
  function requestDTO(row, access) {
    if (row.result?.intent) authorize(access, row.employee.specialization, row.result.intent);
    if (row.result?.kind === 'query' && row.result.accessHash !== accessHash(access)) fail('ACCESS_CHANGED', 'Tus permisos cambiaron. Realiza una consulta nueva.', 409);
    const { accessHash: _privateHash, ...result } = row.result || {};
    const action = row.actions?.[0]; if (action) checkAction(access, action);
    return json({ taskId: row.taskId, requestId: row.requestId, state: row.state, result, action: action ? actionDTO(action) : null });
  }
  async function getTask(input, taskId) {
    return run(input, async ctx => { const a = await store.access(input, ctx); const row = await store.requestByTask(a.scope, taskId, ctx);
      if (!row) fail('NOT_FOUND', 'Atención no encontrada.', 404); if (!permitted(a, row.employee).length) fail('ACCESS_DENIED', 'No tienes acceso a esa atención.', 403); return requestDTO(row, a); });
  }
  async function getAction(input, id) {
    return run(input, async ctx => { const a = await store.access(input, ctx); const row = await store.action(a.scope, id, ctx); checkAction(a, row); return actionDTO(row); });
  }
  async function list(input, query = {}) {
    keys(query, ['limit','cursor']);
    return run(input, async ctx => {
      const a = await store.access(input, ctx); const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
      if (!Number.isInteger(limit)) fail('INVALID_INPUT', 'Límite no válido.', 400);
      const scopeHash = hash([a.scope, accessHash(a)]); let cursor;
      if (query.cursor) { try { const parsed = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()); if (parsed.scope !== scopeHash || typeof parsed.id !== 'string' || parsed.id.length > 100) throw Error(); cursor = parsed.id; } catch { fail('INVALID_CURSOR', 'Actualiza el listado para continuar.', 400); } }
      const specializations = Object.keys(SPECIALIZATIONS).filter(s => permitted(a, { specialization: s }).length);
      const rows = await store.listEmployees(a.scope, specializations, limit, cursor, ctx);
      return { data: rows.slice(0, limit).map(e => ({ id: e.id, specialization: e.specialization, status: e.status, intents: permitted(a, e) })),
        nextCursor: rows.length > limit ? Buffer.from(JSON.stringify({ scope: scopeHash, id: rows[limit - 1].id })).toString('base64url') : null };
    });
  }
  async function product(input, payload) { return payload.productId ? inventory.reads.detail({ ...input, id: payload.productId }) : null; }
  function revision(row, normalized, context, employeeId, number) {
    const at = now(); const missing = [...normalized.missing];
    if (context) {
      if (!context.active) fail('PRODUCT_INACTIVE', 'Selecciona un producto activo.', 409);
      if (context.lotPolicy !== 'untracked' && !normalized.payload.lotCode) missing.push('lotCode');
      if (context.lotPolicy === 'lot_expiry' && !normalized.payload.expiresOn) missing.push('expiresOn');
      if (context.lotPolicy === 'untracked' && (normalized.payload.lotCode || normalized.payload.expiresOn)) fail('INVALID_INPUT', 'Este producto no utiliza lote ni vencimiento.', 400);
    }
    const pContext = context ? productContext(context) : null;
    const versioned = { tenantId: row.tenantId, principalKey: row.principalKey, employeeId, actionId: row.id, kind: normalized.kind, number, contractVersion: 1, canonicalVersion: 1, payload: normalized.payload, productContext: pContext };
    return { id: randomUUID(), tenantId: row.tenantId, principalKey: row.principalKey, actionId: row.id, number, contractVersion: 1, canonicalVersion: 1,
      validationState: missing.length ? 'borrador' : 'lista', payload: normalized.payload, missingFields: missing,
      preview: { ...normalized.payload, ...(context ? { productName: context.name, presentation: context.presentation, lotPolicy: context.lotPolicy } : {}) },
      ...(pContext ? { productContext: pContext } : {}), payloadHash: hash(versioned), createdAt: at, expiresAt: missing.length ? null : new Date(at.getTime() + 900000) };
  }
  async function decision(taskId, action, input, ctx) { return store.audit.registerAgentDecision({ agentTaskId: taskId, action, input, reasoning: 'Validación del contrato, permisos actuales y confirmación separada cuando corresponde.' }, ctx); }
  async function request(input, employeeId, body) {
    keys(body, ['requestId','text','intent','fields']);
    if (!uuid(body.requestId)) fail('INVALID_REQUEST_ID', 'La solicitud necesita un identificador UUID.', 400);
    const natural = body.text !== undefined;
    if (natural && (body.intent !== undefined || body.fields !== undefined)) fail('INVALID_INPUT', 'Usa texto o formulario por solicitud.', 400);
    const clean = natural ? { text: text(body.text, 'Solicitud') } : { intent: body.intent, fields: intentInput(body.intent, body.fields || {}) };
    if (natural && !clean.text) fail('INVALID_INPUT', 'Escribe la tarea que necesitas.', 400);
    const inputHash = hash({ contractVersion: 1, canonicalVersion: 1, employeeId, ...clean });
    const initial = await run(input, async ctx => {
      const a = await store.access(input, ctx, { lock: true });
      const previous = await store.requestByKey(a.scope, body.requestId, ctx);
      if (previous) { if (previous.employeeId !== employeeId || previous.inputHash !== inputHash) fail('REQUEST_CHANGED', 'Ese identificador pertenece a otra solicitud.', 409); return previous; }
      const enabled = await store.access(input, ctx, { lock: true, employeeId, active: true });
      if (!permitted(enabled, enabled.employee).length) fail('ACCESS_DENIED', 'No tienes tareas permitidas para este empleado.', 403);
      if (!natural) authorize(enabled, enabled.employee.specialization, body.intent);
      ctx.eventPublisher = store.collector();
      const { task } = await store.audit.startAgentTask({ digitalEmployeeId: employeeId, origin: store.operatorAccess?.grantFor(input) ? 'whatsapp_operational' : 'dashboard_operational' }, ctx);
      const row = await store.createRequest({ id: randomUUID(), ...enabled.scope, requestId: body.requestId.toLowerCase(), employeeId, taskId: task.id,
        contractVersion: 1, canonicalVersion: 1, inputMode: natural ? 'texto' : 'estructurado', canonicalInput: clean, inputHash, createdAt: now(), updatedAt: now() }, ctx);
      await store.flush(row, ctx.eventPublisher, `request:${row.id}:start`, ctx); return { ...row, employee: enabled.employee };
    });
    if (['resuelta','requiere_revision'].includes(initial.state)) return getTask(input, initial.taskId);
    const claim = await run(input, async ctx => {
      const a = await store.access(input, ctx, { lock: true, employeeId });
      const row = await store.lockRequest(initial.id, a.scope, ctx);
      if (row.attemptCount >= 3 && (row.state === 'pendiente' || (row.state === 'procesando' && row.claimUntil <= now()))) {
        ctx.eventPublisher = store.collector();
        await store.audit.generateEscalation({ agentTaskId: row.taskId, context: { requestId: row.id, code: 'REQUEST_RETRY_LIMIT' } }, ctx);
        await store.updateRequest(row.id, { state: 'requiere_revision', claimOwner: null, claimUntil: null, lastErrorCode: 'REQUEST_RETRY_LIMIT', updatedAt: now() }, ctx);
        await store.flush(row, ctx.eventPublisher, `request:${row.id}:escalation`, ctx); return null;
      }
      return store.claim(row, ctx);
    });
    if (!claim) return getTask(input, initial.taskId);
    let extracted = natural ? null : clean; let outcome; let normalized; let context; let readAccessHash;
    try {
      if (natural) extracted = await interpret(clean.text, initial.employee.specialization).catch(() => null);
      if (extracted?.intent === 'inventory_search' && store.operatorAccess?.grantFor(input)) extracted = { ...extracted, fields: { ...extracted.fields, limit: 2 } };
      if (extracted) {
        intentInput(extracted.intent, extracted.fields);
        await run(input, async ctx => { const a = await store.access(input, ctx, { employeeId }); authorize(a, a.employee.specialization, extracted.intent); });
        if (['prepare_expense','prepare_entry'].includes(extracted.intent)) { normalized = normalizeCommand(extracted.intent, extracted.fields, now()); context = extracted.intent === 'prepare_entry' ? await product(input, normalized.payload) : null; }
        else {
          const observed = await run(input, async ctx => {
            const access = await store.access(input, ctx, { lock: true, employeeId });
            authorize(access, access.employee.specialization, extracted.intent);
            return { data: await read(extracted.intent, extracted.fields, input, ctx), accessHash: accessHash(access) };
          });
          outcome = observed.data; readAccessHash = observed.accessHash;
        }
      }
    } catch (e) {
      if (!e.status && !e.name?.endsWith('Error')) throw e;
      if (!e.status || e.status >= 500) throw e;
      outcome = { error: e.message, code: e.code || 'INVALID_INPUT' }; normalized = null;
    }
    await run(input, async ctx => {
      const a = await store.access(input, ctx, { lock: true, employeeId, active: !!normalized });
      const row = await store.lockRequest(initial.id, a.scope, ctx); store.validClaim(row, claim);
      if (extracted) authorize(a, a.employee.specialization, extracted.intent);
      if (readAccessHash && readAccessHash !== accessHash(a)) fail('ACCESS_CHANGED', 'Tus permisos cambiaron durante la consulta. Recupera la atención para volver a consultar.', 409);
      ctx.eventPublisher = store.collector(); let result;
      if (normalized) {
        const action = { id: randomUUID(), ...a.scope, requestId: row.id, taskId: row.taskId, kind: normalized.kind, executionKey: randomUUID(), currentRevision: 1, createdAt: now() };
        const rev = revision(action, normalized, context, employeeId, 1);
        await store.createAction({ ...action, state: rev.validationState }, rev, ctx);
        await decision(row.taskId, 'preparar_propuesta', { actionId: action.id, revision: 1, payloadHash: rev.payloadHash }, ctx);
        result = { kind: 'proposal', intent: extracted.intent, actionId: action.id };
      } else {
        result = extracted ? { kind: 'query', intent: extracted.intent, parameters: extracted.fields, observedAt: now().toISOString(), data: outcome, accessHash: readAccessHash || accessHash(a) } : { kind: 'clarification', message: 'Selecciona una tarea y completa el formulario para continuar.' };
        result = limitedResult(result);
        await decision(row.taskId, extracted?.intent || 'solicitar_aclaracion', { requestId: row.id, effect: 'ninguno' }, ctx);
        await store.audit.completeAgentTask({ agentTaskId: row.taskId, result: { v: 1, operationalRequestId: row.id, outcome: 'consulta', effect: 'ninguno' } }, ctx);
      }
      await store.finishRequest(claim, { state: 'resuelta', resultCode: result.kind, result, claimOwner: null, claimUntil: null, updatedAt: now() }, ctx);
      if (store.operatorAccess) await store.operatorAccess.completeWork(input, { taskId: row.taskId, operationalRequestId: row.id }, ctx);
      await store.flush(row, ctx.eventPublisher, `request:${row.id}:resolved`, ctx);
    });
    return getTask(input, initial.taskId);
  }
  async function revise(input, id, expectedRevision, patch, refresh = false) {
    const snapshot = await getAction(input, id); keys(patch, snapshot.kind === 'registrar_gasto' ? ['amount','category','responsible','date','description','paymentMethod','notes'] : ['productId','quantity','unitCost','lotCode','expiresOn','reason']);
    const normalized = normalizeCommand(intentFor(snapshot.kind), { ...snapshot.payload, ...patch }, now());
    const context = snapshot.kind === 'entrada_inventario' ? await product(input, normalized.payload) : null;
    await run(input, async ctx => {
      const basic = await store.access(input, ctx, { lock: true }); const view = await store.action(basic.scope, id, ctx);
      const a = await store.access(input, ctx, { lock: true, employeeId: view.request.employeeId, active: true });
      const row = await store.action(a.scope, id, ctx, true); checkAction(a, row); pending(row, expectedRevision, refresh);
      if (store.operatorAccess) await store.operatorAccess.choice(input, row, ctx);
      if (snapshot.revision !== row.currentRevision || hash(snapshot.payload) !== hash(row.current.payload)) fail('REVISION_CHANGED', 'La propuesta cambió. Recupera la vista previa antes de corregir.', 409);
      ctx.eventPublisher = store.collector(); const rev = revision(row, normalized, context, row.request.employeeId, row.currentRevision + 1);
      await store.addRevision(row, rev, ctx); await decision(row.taskId, 'corregir_propuesta', { actionId: id, revision: rev.number, payloadHash: rev.payloadHash }, ctx);
      if (store.operatorAccess) await store.operatorAccess.completeWork(input, { actionId: id, revision: rev.number }, ctx);
      await store.flush(row.request, ctx.eventPublisher, `revision:${rev.id}`, ctx);
    }); return getAction(input, id);
  }
  function pending(row, expectedRevision, allowExpired = false) {
    if (!Number.isInteger(expectedRevision) || expectedRevision !== row.currentRevision) fail('REVISION_CHANGED', 'La propuesta cambió. Actualiza su vista previa.', 409);
    if (!['borrador','lista'].includes(row.state)) fail('ACTION_CLOSED', 'La propuesta ya terminó. Consulta su resultado.', 409);
    if (!allowExpired && row.current.expiresAt && row.current.expiresAt <= now()) fail('PROPOSAL_EXPIRED', 'La propuesta venció. Actualiza su vista previa para continuar.', 410);
  }
  async function confirmation(input, id, expectedRevision, ctx) {
    const basic = await store.access(input, ctx, { lock: true }); const view = await store.action(basic.scope, id, ctx);
    const a = await store.access(input, ctx, { lock: true, employeeId: view.request.employeeId });
    const row = await store.action(a.scope, id, ctx, true); checkAction(a, row);
    if (store.operatorAccess) await store.operatorAccess.confirmation(input, row, ctx);
    if (row.receipts[0]) {
      if (store.operatorAccess) {
        if (ctx.operatorInteraction?.state === 'offered') await store.operatorAccess.recordReceipt(input, row.receipts[0], ctx);
        await store.operatorAccess.completeWork(input, { actionId: row.id, receiptId: row.receipts[0].id }, ctx);
      }
      return { row, access: a, recovered: actionDTO(row) };
    }
    if (a.employee.status !== 'activo') fail('EMPLOYEE_PAUSED', 'El empleado está pausado.', 409);
    pending(row, expectedRevision); if (row.state !== 'lista') fail('MISSING_FIELDS', 'Completa los datos antes de confirmar.', 422);
    ctx.eventPublisher = store.collector(); return { row, access: a };
  }
  async function saveExecution(row, access, result, destination, ctx, inputForExecution) {
    const { decision: d } = await decision(row.taskId, row.kind, { actionId: row.id, revision: row.currentRevision, payloadHash: row.current.payloadHash }, ctx);
    const receipt = await store.receipt({ id: randomUUID(), tenantId: row.tenantId, principalKey: row.principalKey, actionId: row.id, taskId: row.taskId, kind: row.kind,
      revisionNumber: row.currentRevision, payloadHash: row.current.payloadHash, executionKey: row.executionKey, contractVersion: row.current.contractVersion, decisionId: d.id,
      ...destination, actorName: access.snapshot.actorName, actorRole: access.snapshot.actorRole, resultVersion: 1, result: limitedResult(result), confirmedAt: now() }, ctx);
    if (store.operatorAccess) await store.operatorAccess.recordReceipt(inputForExecution, receipt, ctx);
    if (store.operatorAccess) await store.operatorAccess.completeWork(inputForExecution, { actionId: row.id, receiptId: receipt.id }, ctx);
    await store.audit.completeAgentTask({ agentTaskId: row.taskId, result: { v: 1, operationalRequestId: row.requestId, actionId: row.id, receiptId: receipt.id, outcome: 'confirmada' } }, ctx);
    await store.closeAction(row.id, 'confirmada', null, ctx); await store.flush(row.request, ctx.eventPublisher, `action:${row.id}:terminal`, ctx, receipt.id);
  }
  async function confirm(input, id, expectedRevision) {
    const snapshot = await getAction(input, id);
    if (snapshot.kind === 'registrar_gasto') {
      await run(input, async ctx => { const { row, access, recovered } = await confirmation(input, id, expectedRevision, ctx); if (recovered) return;
        const { expense } = await finance.registerExpense({ ...row.current.payload, amount: Number(row.current.payload.amount), tenantId: input.tenantId }, ctx);
        await saveExecution(row, access, { expense: json(expense) }, { expenseId: expense.id }, ctx, input);
      });
    } else {
      const executionKey = await run(input, async ctx => { const a = await store.access(input, ctx); return (await store.action(a.scope, id, ctx)).executionKey; });
      const operatorProof = store.operatorAccess ? await store.operatorAccess.acquire(input) : null;
      await inventory.commands.entry({ ...input, kind: 'register_entry', operationKey: executionKey, command: snapshot.payload }, {
        async before(ctx) {
          ctx.operatorProof = operatorProof;
          const state = await confirmation(input, id, expectedRevision, ctx); ctx.operational = state;
          if (state.recovered) return { recovered: state.recovered };
          if (snapshot.revision !== state.row.currentRevision || hash(snapshot.payload) !== hash(state.row.current.payload)) fail('REVISION_CHANGED', 'La propuesta cambió. Recupera la vista previa antes de confirmar.', 409);
        },
        async validateProduct(p, ctx) { if (hash(productContext(p)) !== hash(ctx.operational.row.current.productContext)) fail('PRODUCT_CHANGED', 'El producto cambió. Revisa y actualiza la propuesta.', 409); },
        async after(result, event, ctx) { if (!event) fail('RESULT_INCONSISTENT', 'La operación requiere revisión. Conserva su identificador.', 409);
          await ctx.eventPublisher.publish(event.name, event.payload);
          await saveExecution(ctx.operational.row, ctx.operational.access, json(result), { inventoryOperationId: result.operationId }, ctx, input); },
      });
    }
    return getAction(input, id);
  }
  async function discard(input, id, expectedRevision) {
    await run(input, async ctx => { const basic = await store.access(input, ctx, { lock: true }); const row = await store.action(basic.scope, id, ctx, true); checkAction(basic, row);
      if (row.state === 'descartada') return; pending(row, expectedRevision); ctx.eventPublisher = store.collector();
      await decision(row.taskId, 'descartar_propuesta', { actionId: id, revision: row.currentRevision }, ctx);
      await store.audit.completeAgentTask({ agentTaskId: row.taskId, result: { v: 1, operationalRequestId: row.requestId, actionId: id, outcome: 'descartada', effect: 'ninguno' } }, ctx);
      await store.closeAction(id, 'descartada', 'operator_discard', ctx); await store.flush(row.request, ctx.eventPublisher, `action:${id}:terminal`, ctx);
      if (store.operatorAccess) await store.operatorAccess.completeWork(input, { actionId: id, state: 'descartada' }, ctx);
    }); return getAction(input, id);
  }
  return { list, request, getTask, getAction, revise, confirm, discard, refresh: (input, id, expected) => revise(input, id, expected, {}, true) };
}
module.exports = { buildOperationalAttention };
