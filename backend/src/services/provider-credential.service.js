const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');
function credentialKey(env = process.env) {
  const raw = env.PROVIDER_CREDENTIAL_KEY;
  if (typeof raw !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(raw)) throw new Error('PROVIDER_ENCRYPTION_NOT_CONFIGURED');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32 || key.toString('base64') !== raw) throw new Error('PROVIDER_ENCRYPTION_NOT_CONFIGURED');
  return key;
}
const associated = (tenantId, connectionId) => Buffer.from(JSON.stringify(['whatsapp-token-v1', tenantId, connectionId]));
function encryptProviderToken(token, tenantId, connectionId, env = process.env) {
  if (typeof token !== 'string' || !token || !tenantId || !connectionId) throw new Error('INVALID_PROVIDER_CREDENTIAL');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', credentialKey(env), iv);
  cipher.setAAD(associated(tenantId, connectionId));
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
}
function decryptProviderToken(encrypted, tenantId, connectionId, env = process.env) {
  try {
    const value = JSON.parse(encrypted);
    if (value.v !== 1 || Buffer.from(value.iv, 'base64').length !== 12 || Buffer.from(value.tag, 'base64').length !== 16) throw Error('format');
    const decipher = createDecipheriv('aes-256-gcm', credentialKey(env), Buffer.from(value.iv, 'base64'));
    decipher.setAAD(associated(tenantId, connectionId)); decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8');
  } catch { throw new Error('PROVIDER_CREDENTIAL_UNAVAILABLE'); }
}
module.exports = { credentialKey, encryptProviderToken, decryptProviderToken };
