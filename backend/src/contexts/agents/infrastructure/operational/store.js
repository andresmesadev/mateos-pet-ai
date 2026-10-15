const { randomUUID } = require('node:crypto');
const { fail, hash, json } = require('../../application/operational/policy');
const { serializationConflict, yieldRetry } = require('../../../shared/persistence/postgres-retry');
const actionInclude = { current: true, receipts: true, request: { include: { employee: true } } };
const requestInclude = { employee: true, actions: { include: actionInclude } };
function buildOperationalStore({ prisma, accessReader, audit, operatorAccess, clock = () => new Date() }) {
  async function run(fn, input) {
    const deadline = Date.now() + 12000;
    for (let attempt = 0; attempt < 3; attempt++) {
      const operatorProof = operatorAccess && input ? await operatorAccess.acquire(input) : null;
      try { return await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='5s'");
        return fn({ tx, operatorProof });
      }, { isolationLevel: 'Serializable', maxWait: 2000, timeout: 10000 }); }
      catch (e) {
        const retryable = serializationConflict(e) || e.code === 'P2002';
        if (!retryable || attempt === 2 || Date.now() + 2000 > deadline) throw e;
        await yieldRetry(attempt); }
    }
  }
  async function access(input, ctx, { lock = false, employeeId, active = false } = {}) {
    if (!input.tenantId || input.viewAllTenants || !input.actor) fail('ACCESS_DENIED', 'Selecciona un establecimiento e inicia sesión.', 403);
    if (operatorAccess) await operatorAccess.check(input, ctx);
    if (lock) {
      await ctx.tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${input.tenantId} FOR SHARE`;
      if (input.actor.staffId) {
        await ctx.tx.$queryRaw`SELECT id FROM "Staff" WHERE id=${input.actor.staffId} AND "tenantId"=${input.tenantId} FOR SHARE`;
        await ctx.tx.$queryRaw`SELECT "staffId" FROM "StaffCredential" WHERE "staffId"=${input.actor.staffId} FOR SHARE`;
      }
    }
    const current = await accessReader.readAccess(input, ctx);
    if (!current.capabilities.finance && !current.capabilities.inventory_read) fail('ACCESS_DENIED', 'No tienes acceso a estos asistentes.', 403);
    const scope = { tenantId: input.tenantId, principalKey: current.principalKey };
    let employee;
    if (employeeId) {
      if (lock) await ctx.tx.$queryRaw`SELECT id FROM "DigitalEmployee" WHERE id=${employeeId} AND "tenantId"=${input.tenantId} FOR SHARE`;
      employee = await ctx.tx.digitalEmployee.findFirst({ where: { id: employeeId, tenantId: input.tenantId } });
      if (!employee || !['asistente_financiero','asistente_administrativo'].includes(employee.specialization)) fail('EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.', 404);
      if (active && employee.status !== 'activo') fail('EMPLOYEE_PAUSED', 'El empleado está pausado.', 409);
    }
    return { ...current, scope, employee };
  }
  function collector() { const events = []; return { events, async publish(name, payload) { events.push({ name, payload: json(payload), occurredAt: clock() }); } }; }
  async function flush(request, publisher, causeKey, ctx, receiptId = null) {
    for (const [ordinal, event] of publisher.events.entries()) {
      const origin = event.name === 'GastoRegistrado' ? 'Finanzas' : event.name === 'EntradaDeInventarioRegistrada' ? 'Inventario' : 'Empleados Digitales';
      const envelope = { tenantId: request.tenantId, eventTypeName: event.name, payload: event.payload, origin, occurredAt: event.occurredAt.toISOString() };
      await ctx.tx.publicationIntent.create({ data: { id: randomUUID(), tenantId: request.tenantId, principalKey: request.principalKey, requestId: request.id,
        taskId: request.taskId, receiptId, causeKey, ordinal, eventName: event.name, origin, payload: event.payload, occurredAt: event.occurredAt,
        canonicalVersion: 1, envelopeHash: hash(envelope), nextAttemptAt: clock(), createdAt: clock(), updatedAt: clock() } });
    }
  }
  async function requestByKey(scope, requestId, ctx) { return ctx.tx.operationalRequest.findFirst({ where: { ...scope, requestId }, include: requestInclude }); }
  async function publication(requestId, ctx) {
    const groups = await ctx.tx.publicationIntent.groupBy({ by: ['certificationState','notificationState'], where: { requestId }, _count: { _all: true } });
    const result = { pending: 0, review: 0, verified: 0 };
    for (const g of groups) result[g.certificationState === 'requiere_revision' || g.notificationState === 'requiere_revision' ? 'review' : g.notificationState === 'verificada' ? 'verified' : 'pending'] += g._count._all;
    return result;
  }
  async function requestByTask(scope, taskId, ctx) {
    const row = await ctx.tx.operationalRequest.findFirst({ where: { ...scope, taskId }, include: requestInclude });
    if (row) for (const action of row.actions) action.publication = await publication(row.id, ctx);
    return row;
  }
  async function lockRequest(id, scope, ctx) {
    const rows = await ctx.tx.$queryRaw`SELECT id FROM "OperationalRequest" WHERE id=${id} AND "tenantId"=${scope.tenantId} AND "principalKey"=${scope.principalKey} FOR UPDATE`;
    if (!rows.length) fail('NOT_FOUND', 'Atención no encontrada.', 404);
    return ctx.tx.operationalRequest.findUnique({ where: { id }, include: requestInclude });
  }
  async function action(scope, id, ctx, lock = false) {
    let row = await ctx.tx.operationalAction.findFirst({ where: { ...scope, id }, include: actionInclude });
    if (!row) fail('NOT_FOUND', 'Propuesta no encontrada.', 404);
    if (lock) {
      await lockRequest(row.requestId, scope, ctx);
      await ctx.tx.$queryRaw`SELECT id FROM "OperationalAction" WHERE id=${id} FOR UPDATE`;
      row = await ctx.tx.operationalAction.findUnique({ where: { id }, include: actionInclude });
    }
    row.publication = await publication(row.requestId, ctx);
    return row;
  }
  return { run, access, collector, flush, requestByKey, requestByTask, lockRequest, action, audit, clock, operatorAccess,
    async listEmployees(scope, specializations, limit, cursor, ctx) {
      return ctx.tx.digitalEmployee.findMany({ where: { tenantId: scope.tenantId, specialization: { in: specializations }, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: limit + 1 });
    },
    async createRequest(data, ctx) { return ctx.tx.operationalRequest.create({ data }); },
    async updateRequest(id, data, ctx) { return ctx.tx.operationalRequest.update({ where: { id }, data }); },
    async finishRequest(claim, data, ctx) {
      const changed = await ctx.tx.operationalRequest.updateMany({ where: { id: claim.id, state: 'procesando', claimOwner: claim.claimOwner, claimGeneration: claim.claimGeneration, claimUntil: { gt: clock() } }, data });
      if (!changed.count) fail('CLAIM_LOST', 'La atención fue recuperada por otro proceso.', 409);
    },
    async claim(row, ctx) {
      const now = clock(); const owner = randomUUID();
      const changed = await ctx.tx.operationalRequest.updateMany({ where: { id: row.id, claimGeneration: row.claimGeneration, attemptCount: { lt: 3 },
        OR: [{ state: 'pendiente' }, { state: 'procesando', claimUntil: { lte: now } }] },
      data: { state: 'procesando', claimGeneration: { increment: 1 }, attemptCount: { increment: 1 }, claimOwner: owner, claimUntil: new Date(now.getTime() + 30000), updatedAt: now } });
      return changed.count ? ctx.tx.operationalRequest.findUnique({ where: { id: row.id } }) : null;
    },
    validClaim(row, claim) { if (row.state !== 'procesando' || row.claimOwner !== claim.claimOwner || row.claimGeneration !== claim.claimGeneration || row.claimUntil <= clock()) fail('CLAIM_LOST', 'La atención fue recuperada por otro proceso. Consulta su estado.', 409); },
    async createAction(data, revision, ctx) { const row = await ctx.tx.operationalAction.create({ data }); await ctx.tx.actionRevision.create({ data: revision }); return row; },
    async addRevision(row, data, ctx) { await ctx.tx.actionRevision.create({ data }); return ctx.tx.operationalAction.update({ where: { id: row.id }, data: { currentRevision: data.number, state: data.validationState } }); },
    async closeAction(id, state, reason, ctx) { return ctx.tx.operationalAction.update({ where: { id }, data: { state, terminalReason: reason, closedAt: clock() } }); },
    async receipt(data, ctx) { return ctx.tx.executionReceipt.create({ data }); },
  };
}
module.exports = { buildOperationalStore };
