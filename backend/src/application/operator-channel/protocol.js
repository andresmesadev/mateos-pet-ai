const { createHash, createHmac, timingSafeEqual, randomBytes, randomUUID } = require('node:crypto');
const VERSION = 'operator-v1';
function canonical(value) {
  if (value === null || typeof value !== 'object') {
    if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('INVALID_PROTOCOL_VALUE');
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  return Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
}
const encode = value => JSON.stringify(canonical(value));
const digest = value => createHash('sha256').update(encode(value)).digest('hex');
function config(env = process.env) {
  const enabled = env.OPERATOR_WHATSAPP_ENABLED === 'true';
  const key = env.OPERATOR_CHANNEL_HMAC_KEY || '';
  const keyVersion = env.OPERATOR_CHANNEL_KEY_VERSION || 'v1';
  if (enabled && (Buffer.byteLength(key) < 32 || !/^[A-Za-z0-9_-]{1,32}$/.test(keyVersion))) throw new Error('OPERATOR_KEY_UNAVAILABLE');
  return { enabled, key, keyVersion };
}
const mac = (key, purpose, value) => createHmac('sha256', key).update(`${VERSION}\n${purpose}\n${encode(value)}`).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
const principal = email => `admin:${String(email).trim().normalize('NFC').toLowerCase()}`;
const token = () => randomBytes(24).toString('base64url');
function sign(key, keyVersion, purpose, body, ttl = 30000, at = new Date(), operationId = randomUUID()) {
  const claim = { v: 1, keyVersion, purpose, operationId, nonce: token(), issuedAt: at.toISOString(), expiresAt: new Date(+at + ttl).toISOString(), body };
  return { ...claim, signature: mac(key, purpose, claim) };
}
function verify(key, keyVersion, envelope, purpose, ttl = 30000, at = new Date()) {
  if (!envelope || Object.keys(envelope).sort().join(',') !== 'body,expiresAt,issuedAt,keyVersion,nonce,operationId,purpose,signature,v') throw new Error('INVALID_PROOF');
  const { signature, ...claim } = envelope;
  const issued = Date.parse(claim.issuedAt), expires = Date.parse(claim.expiresAt);
  if (claim.v !== 1 || claim.keyVersion !== keyVersion || claim.purpose !== purpose ||
      typeof claim.nonce !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(claim.nonce) ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(claim.operationId) ||
      !Number.isFinite(issued) || !Number.isFinite(expires) || issued > +at + 5000 || expires <= +at || expires <= issued || expires - issued > ttl ||
      !equal(signature, mac(key, purpose, claim))) throw new Error('INVALID_PROOF');
  return claim;
}
module.exports = { canonical, encode, digest, config, mac, equal, principal, token, sign, verify };
