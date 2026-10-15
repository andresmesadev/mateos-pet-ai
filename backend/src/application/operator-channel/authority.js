const { randomUUID } = require('node:crypto');
const p = require('./protocol');
const { fail } = require('../../contexts/agents/application/operational/policy');
const unavailable = () => fail('OPERATOR_AUTHORITY_UNAVAILABLE', 'No se pudo verificar el acceso. Vuelve al dashboard.', 503);
function buildOperatorAuthority({ prisma, settings = p.config(), fetcher = fetch, issuerUrl = process.env.OPERATOR_AUTHORITY_URL, clock = () => new Date() }) {
  const ready = () => { if (!settings.enabled || !settings.key) unavailable(); };
  async function saveProof(tx, envelope, kind, purpose, scope, result) {
    const claim = p.verify(settings.key, settings.keyVersion, envelope, purpose, kind === 'recent_dashboard' ? 60000 : 30000, clock());
    const data = { id: randomUUID(), issuer: 'dashboard-admin', kind, purpose, ...scope,
      operationId: claim.operationId, nonceDigest: p.mac(settings.key, 'nonce', claim.nonce), keyVersion: claim.keyVersion,
      bindingHash: p.digest(claim.body), issuedAt: new Date(claim.issuedAt), expiresAt: new Date(claim.expiresAt),
      consumedAt: clock(), result: result || {} };
    return tx.operatorProof.create({ data });
  }
  async function state(envelope) {
    ready(); p.verify(settings.key, settings.keyVersion, envelope, 'issuer_state', 30000, clock());
    const row = await prisma.operatorAuthority.findUnique({ where: { issuer: 'dashboard-admin' } });
    return p.sign(settings.key, settings.keyVersion, 'issuer_state_reply', { requestHash: p.digest(envelope), epoch: String(row?.epoch || 0) }, 30000, clock());
  }
  async function register(envelope) {
    ready(); const claim = p.verify(settings.key, settings.keyVersion, envelope, 'register_issuer', 30000, clock());
    const b = claim.body;
    if (!b || Object.keys(b).sort().join(',') !== 'bootId,credentialGeneration,expectedEpoch,principalKey,state' ||
        !/^admin:.{1,250}$/.test(b.principalKey) || !/^[a-f0-9]{64}$/.test(b.credentialGeneration) ||
        !/^[0-9]+$/.test(b.expectedEpoch) || !['active','disabled'].includes(b.state) || !/^[a-f0-9-]{36}$/.test(b.bootId)) unavailable();
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(749211200)::text`;
      const previous = await tx.operatorProof.findUnique({ where: { issuer_kind_operationId: { issuer: 'dashboard-admin', kind: 'issuer_register', operationId: claim.operationId } } });
      let row = await tx.operatorAuthority.findUnique({ where: { issuer: 'dashboard-admin' } });
      if (previous) {
        if (previous.bindingHash !== p.digest(b)) unavailable();
        if (!row || row.bootId !== b.bootId || row.id !== previous.result.authorityId || String(row.epoch) !== previous.result.epoch || String(row.credentialEpoch) !== previous.result.credentialEpoch) {
          fail('ISSUER_EPOCH_CHANGED', 'La autoridad cambió.', 409);
        }
        return previous.result;
      }
      if (String(row?.epoch || 0) !== b.expectedEpoch) fail('ISSUER_EPOCH_CHANGED', 'La autoridad cambió.', 409);
      const at = clock();
      if (!row) row = await tx.operatorAuthority.create({ data: { id: randomUUID(), issuer: 'dashboard-admin', bootId: b.bootId, epoch: 1n, credentialEpoch: 1n,
        principalKey: b.principalKey, credentialGeneration: b.credentialGeneration, keyVersion: settings.keyVersion, state: b.state, registeredAt: at, updatedAt: at } });
      else {
        const changed = row.principalKey !== b.principalKey || row.credentialGeneration !== b.credentialGeneration || row.keyVersion !== settings.keyVersion || row.state !== b.state;
        row = await tx.operatorAuthority.update({ where: { id: row.id }, data: { bootId: b.bootId, epoch: row.epoch + 1n,
          credentialEpoch: row.credentialEpoch + (changed ? 1n : 0n), principalKey: b.principalKey, credentialGeneration: b.credentialGeneration,
          keyVersion: settings.keyVersion, state: b.state, updatedAt: at } });
      }
      const value = { authorityId: row.id, epoch: String(row.epoch), credentialEpoch: String(row.credentialEpoch) };
      await saveProof(tx, envelope, 'issuer_register', 'register_issuer', {}, value);
      return value;
    }, { isolationLevel: 'Serializable', maxWait: 2000, timeout: 10000 });
    return p.sign(settings.key, settings.keyVersion, 'register_issuer_reply', { ...result, requestHash: p.digest(envelope) }, 30000, clock());
  }
  async function live({ tenantId, principalKey, sessionId, purpose = 'access' }) {
    ready();
    let url;
    try { url = new URL(issuerUrl); if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) unavailable(); }
    catch { unavailable(); }
    const request = p.sign(settings.key, settings.keyVersion, 'live_request', { method: 'POST', path: url.pathname, tenantId, principalKey, sessionId, purpose }, 30000, clock());
    let envelope;
    try { const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(2000) });
      if (!response.ok) unavailable(); envelope = await response.json(); }
    catch { unavailable(); }
    const claim = p.verify(settings.key, settings.keyVersion, envelope, purpose, 30000, clock());
    if (claim.body.requestHash !== p.digest(request) || claim.body.tenantId !== tenantId || claim.body.principalKey !== principalKey || claim.body.sessionId !== sessionId || claim.body.state !== 'active') unavailable();
    return envelope;
  }
  async function consumeLive(tx, envelope, { tenantId, principalKey, purpose }) {
    const claim = p.verify(settings.key, settings.keyVersion, envelope, purpose, 30000, clock());
    const b = claim.body;
    await tx.$queryRaw`SELECT id FROM "OperatorAuthority" WHERE issuer='dashboard-admin' FOR SHARE`;
    const row = await tx.operatorAuthority.findUnique({ where: { issuer: 'dashboard-admin' } });
    if (!row || row.state !== 'active' || row.principalKey !== principalKey || b.tenantId !== tenantId || b.principalKey !== principalKey ||
        b.authorityId !== row.id || b.bootId !== row.bootId || b.epoch !== String(row.epoch) || b.credentialEpoch !== String(row.credentialEpoch) || b.credentialGeneration !== row.credentialGeneration) unavailable();
    await saveProof(tx, envelope, 'live_admin', purpose, { tenantId, principalKey, authorityId: row.id, authorityEpoch: row.epoch, credentialEpoch: row.credentialEpoch, generationHash: row.credentialGeneration });
    return row;
  }
  async function consumeRecent(tx, envelope, purpose, scope, binding) {
    ready(); const claim = p.verify(settings.key, settings.keyVersion, envelope, purpose, 60000, clock());
    const b = claim.body;
    if (b.tenantId !== scope.tenantId || b.principalKey !== scope.principalKey || b.bindingHash !== p.digest(binding)) fail('INVALID_PROOF', 'Verifica de nuevo tu identidad.', 403);
    if (scope.principalKey.startsWith('admin:')) {
      const row = await tx.operatorAuthority.findUnique({ where: { issuer: 'dashboard-admin' } });
      if (!row || row.state !== 'active' || row.principalKey !== b.principalKey || b.epoch !== String(row.epoch) || b.credentialEpoch !== String(row.credentialEpoch) || b.credentialGeneration !== row.credentialGeneration) unavailable();
    } else {
      const credential = await tx.staffCredential.findUnique({ where: { staffId: scope.principalKey.slice(6) } });
      if (!credential?.active || b.sessionVersion !== credential.sessionVersion) fail('INVALID_PROOF', 'Verifica de nuevo tu identidad.', 403);
    }
    return saveProof(tx, envelope, 'recent_dashboard', purpose, scope);
  }
  return { state, register, live, consumeLive, consumeRecent, settings };
}
module.exports = { buildOperatorAuthority };
