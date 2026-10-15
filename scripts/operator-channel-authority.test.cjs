const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const p = require('../frontend/lib/operator-channel/protocol.cjs');
const source = fs.readFileSync(path.join(__dirname, '../frontend/lib/operator-channel/authority.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture({ loseAfterCommit = false } = {}) {
  const env = { OPERATOR_WHATSAPP_ENABLED: 'true', OPERATOR_CHANNEL_HMAC_KEY: 'synthetic-review-key-'.repeat(3), OPERATOR_CHANNEL_KEY_VERSION: 'v1',
    ADMIN_EMAIL: 'owner@example.test', ADMIN_PASSWORD: 'synthetic-only', API_URL: 'http://backend:3000', INTERNAL_API_SECRET: 'synthetic-only' };
  let now = Date.now(), epoch = '0', committed = 0, stateCalls = 0;
  const attempts = [], replies = new Map();
  const protocol = { ...p, config: () => p.config(env),
    sign: (key, version, purpose, body, ttl, _at, operationId) => p.sign(key, version, purpose, body, ttl, new Date(now), operationId),
    verify: (key, version, body, purpose, ttl) => p.verify(key, version, body, purpose, ttl, new Date(now)) };
  const context = { exports: {}, globalThis: {}, process: { env }, AbortSignal,
    require: name => name === 'server-only' ? {} : name === './protocol.cjs' ? protocol : name === './admin-auth' ? { canonicalAdminEmail: s => s.trim().normalize('NFC').toLowerCase() } : require(name),
    fetch: async (url, options) => {
      const e = JSON.parse(options.body), purpose = url.endsWith('/state') ? 'issuer_state' : 'register_issuer';
      p.verify(env.OPERATOR_CHANNEL_HMAC_KEY, 'v1', e, purpose, 30000, new Date(now));
      const ok = body => ({ ok: true, json: async () => p.sign(env.OPERATOR_CHANNEL_HMAC_KEY, 'v1', purpose + '_reply', { ...body, requestHash: p.digest(e) }, 30000, new Date(now)) });
      if (purpose === 'issuer_state') { stateCalls++; return ok({ epoch }); }
      attempts.push(e);
      if (attempts.length === 1 && !loseAfterCommit) throw Error('offline-before-commit');
      let result = replies.get(e.operationId);
      if (!result) {
        if (e.body.expectedEpoch !== epoch) return { ok: false };
        epoch = String(Number(epoch) + 1); committed++;
        result = { authorityId: 'authority', epoch, credentialEpoch: '1' }; replies.set(e.operationId, result);
      }
      if (attempts.length === 1) throw Error('response-lost-after-commit');
      return ok(result);
    } };
  vm.runInNewContext(code, context);
  return { ensure: context.exports.ensureOperatorAuthority, attempts, advance: () => { now += 31000; }, replaceAuthority: () => { epoch = '2'; },
    counts: () => ({ committed, stateCalls }) };
}

for (const loseAfterCommit of [false, true]) test(`expired registration recovers the same operation after ${loseAfterCommit ? 'lost committed response' : 'failure before commit'}`, async () => {
  const f = fixture({ loseAfterCommit });
  await assert.rejects(f.ensure()); f.advance();
  assert.equal((await f.ensure()).epoch, '1');
  assert.equal(f.attempts[0].operationId, f.attempts[1].operationId);
  assert.deepEqual(f.attempts[0].body, f.attempts[1].body);
  assert.notEqual(f.attempts[0].nonce, f.attempts[1].nonce);
  assert.notEqual(f.attempts[0].expiresAt, f.attempts[1].expiresAt);
  await f.ensure(); assert.equal(f.attempts.length, 2);
  assert.deepEqual(f.counts(), { committed: 1, stateCalls: 1 });
});

test('an interrupted old boot does not refresh its expected epoch to take over a newer authority', async () => {
  const f = fixture(); await assert.rejects(f.ensure()); f.advance(); f.replaceAuthority();
  await assert.rejects(f.ensure()); await assert.rejects(f.ensure());
  assert.equal(f.counts().stateCalls, 1);
  assert.ok(f.attempts.every(e => e.body.expectedEpoch === '0' && e.operationId === f.attempts[0].operationId));
});

test('the authority example targets the actual internal Next port in Compose', () => {
  const compose = fs.readFileSync(path.join(__dirname, '../docker-compose.yml'), 'utf8');
  const example = fs.readFileSync(path.join(__dirname, '../backend/.env.example'), 'utf8');
  const port = compose.split('  frontend:')[1].match(/PORT: "(\d+)"/)[1];
  const url = new URL(example.match(/^OPERATOR_AUTHORITY_URL=(.+)$/m)[1].trim());
  assert.equal(url.hostname, 'frontend'); assert.equal(url.port, port);
  assert.equal(url.pathname, '/api/internal/operator-authority');
});
